// Сырые картинки ChatGPT → вырезки коллажа и фактуры.
//   raw/collage/<id>.(png|jpg|webp) → public/assets/collage/<id>.webp (альфа, обрезка, ≤ 480 px)
//   raw/textures/<id>.(jpg|png)     → src/assets/textures/<id>.webp (ч/б тайл 512×512, без альфы; в сборку попадают только существующие)
// Фон у ChatGPT — белый или нарисованная серая шахматка без альфы. Убираем его заливкой от краёв:
// соседние светлые пиксели с низкой насыщенностью. Белые места внутри предмета (лист, циферблат)
// краёв не касаются и остаются. Ч/б и белую «ножничную» обводку вырезкам даёт CSS.
// После обработки в data/*.json пути assets/collage/<id>.svg меняются на .webp.
// Мягкую серую тень предмета на фоне тоже убираем (--keep-shadows оставляет).
// Запуск из корня проекта: npm run collage:normalize [-- id …] [-- --no-blend] [-- --keep-shadows]
import sharp from 'sharp';
import { readFile, writeFile, readdir, mkdir, access } from 'node:fs/promises';

const RAW_COLLAGE = 'raw/collage';
const RAW_TEXTURES = 'raw/textures';
const OUT_COLLAGE = 'public/assets/collage';
const OUT_TEXTURES = 'src/assets/textures';
const MAX_SIDE = 480; // на экране вещь не больше ~250 px — запас на двойную плотность
const PAD = 2; // прозрачный запас вокруг вырезки, чтобы края не резались при ресайзе
const TILE = 512;
const SAT = 28; // max − min канала: у фона почти ноль, у шахматки тоже
const TOL = 14; // запас вниз от самого тёмного тона фона
// тень от предмета на белом фоне: серая, гладкая, без контура — её тоже убираем
const SHADOW_SAT = 24;
const SHADOW_LUM = 105;
const SHADOW_GRAD = 7; // перепад яркости к соседям: у тени мягкий, на контуре предмета резкий

const args = process.argv.slice(2);
const noBlend = args.includes('--no-blend');
const keepShadows = args.includes('--keep-shadows');
const only = args.filter((a) => !a.startsWith('--'));

const exists = async (p) => access(p).then(() => true, () => false);

// <id> → путь, по одному файлу на id (png важнее webp, webp важнее jpg)
async function sources(dir, exts) {
  if (!(await exists(dir))) return new Map();
  const map = new Map();
  for (const name of (await readdir(dir)).sort()) {
    const m = name.match(/^(.+)\.([a-z]+)$/i);
    if (!m || !exts.includes(m[2].toLowerCase())) continue;
    const [, id, ext] = m;
    if (only.length && !only.includes(id)) continue;
    const prev = map.get(id);
    if (prev && exts.indexOf(prev.ext) <= exts.indexOf(ext.toLowerCase())) {
      console.warn(`  ${id}: есть и ${prev.name}, и ${name} — беру ${prev.name}`);
      continue;
    }
    map.set(id, { name, ext: ext.toLowerCase(), path: `${dir}/${name}` });
  }
  return map;
}

// Порог светлоты фона: по краевым пикселям ищем самый тёмный заметный тон
// (у белого фона ≈ 250, у шахматки ≈ 200) и берём его с запасом.
function backgroundFloor(data, w, h) {
  const bins = new Array(64).fill(0);
  let total = 0;
  const visit = (x, y) => {
    const o = (y * w + x) * 4;
    if (data[o + 3] < 16) return;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > SAT) return;
    const lum = (r + g + b) / 3;
    if (lum < 140) return;
    bins[lum >> 2]++;
    total++;
  };
  for (let x = 0; x < w; x++) { visit(x, 0); visit(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { visit(0, y); visit(w - 1, y); }
  if (!total) return null;
  let darkest = 63;
  for (let k = 0; k < 64; k++) if (bins[k] >= total * 0.03) { darkest = k; break; }
  return Math.min(240, Math.max(150, darkest * 4 - TOL));
}

function cutBackground(data, w, h) {
  const floor = backgroundFloor(data, w, h);
  const n = w * h;
  const isBg = (i) => {
    const o = i * 4;
    if (data[o + 3] < 16) return true;
    if (floor === null) return false;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    return Math.max(r, g, b) - Math.min(r, g, b) <= SAT && Math.min(r, g, b) >= floor;
  };
  // заливка от всех краёв, 4-связность
  const bg = new Uint8Array(n);
  const stack = [];
  const seed = (i) => { if (!bg[i] && isBg(i)) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (i >= w) seed(i - w);
    if (i < n - w) seed(i + w);
  }
  if (floor !== null && !keepShadows) eatShadows(data, w, h, bg);
  dropSpecks(bg, w, h);
  return { bg, floor };
}

// Вторая заливка от уже найденного фона — по гладким серым пикселям тени. Контур предмета даёт резкий
// перепад яркости, и заливка на нём останавливается; белое внутри предмета (чашка, циферблат) не трогаем.
function eatShadows(data, w, h, bg) {
  const n = w * h;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
  const soft = (i) => {
    const o = i * 4;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > SHADOW_SAT || lum[i] < SHADOW_LUM) return false;
    const x = i % w;
    let grad = 0;
    if (x > 0) grad = Math.max(grad, Math.abs(lum[i] - lum[i - 1]));
    if (x < w - 1) grad = Math.max(grad, Math.abs(lum[i] - lum[i + 1]));
    if (i >= w) grad = Math.max(grad, Math.abs(lum[i] - lum[i - w]));
    if (i < n - w) grad = Math.max(grad, Math.abs(lum[i] - lum[i + w]));
    return grad <= SHADOW_GRAD;
  };
  const stack = [];
  for (let i = 0; i < n; i++) if (bg[i]) stack.push(i);
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < n - w ? i + w : -1];
    for (const k of next) if (k >= 0 && !bg[k] && soft(k)) { bg[k] = 1; stack.push(k); }
  }
}

// мелкие островки (шум JPEG, пятна на фоне) тоже становятся фоном; несколько крупных частей
// (два крыла) остаются
function dropSpecks(bg, w, h) {
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const comps = [];
  const stack = [];
  for (let i = 0; i < n; i++) {
    if (bg[i] || label[i] >= 0) continue;
    const pixels = [];
    label[i] = comps.length;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop();
      pixels.push(j);
      const x = j % w, y = (j / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx;
        if (!bg[k] && label[k] < 0) { label[k] = comps.length; stack.push(k); }
      }
    }
    comps.push(pixels);
  }
  const largest = Math.max(0, ...comps.map((c) => c.length));
  const min = Math.max(64, largest * 0.005);
  for (const c of comps) if (c.length < min) for (const j of c) bg[j] = 1;
}

async function collage(id, src) {
  const { data, info } = await sharp(src.path).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const { bg, floor } = cutBackground(data, w, h);

  // край смягчаем на 1 px: доля предмета в окне 3×3, наружу маска не растёт
  let minX = w, maxX = -1, minY = h, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (bg[i]) { data[i * 4 + 3] = 0; continue; }
    let fg = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && !bg[ny * w + nx]) fg++;
    }
    data[i * 4 + 3] = Math.round((data[i * 4 + 3] * fg) / 9);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (maxX < 0) { console.warn(`  ${id}: после удаления фона ничего не осталось — пропуск`); return false; }
  const left = Math.max(0, minX - PAD), top = Math.max(0, minY - PAD);
  const cw = Math.min(w, maxX + PAD + 1) - left, ch = Math.min(h, maxY + PAD + 1) - top;

  const out = `${OUT_COLLAGE}/${id}.webp`;
  const res = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left, top, width: cw, height: ch })
    .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
    .webp({ quality: 82, alphaQuality: 90, effort: 5 })
    .toFile(out);
  const fgShare = (1 - bg.reduce((s, v) => s + v, 0) / (w * h)) * 100;
  const how = floor === null ? 'фон не найден, только альфа' : `фон светлее ${floor}`;
  console.log(`  ${id}: ${src.name} ${w}×${h} → ${res.width}×${res.height}, ${how}, предмет ${fgShare.toFixed(0)}% кадра`);
  return true;
}

// Тайл: ч/б, 512×512 по центру. Чтобы не было шва даже у «бесшовной» картинки ChatGPT, края
// смешиваются со сдвинутой на полтайла копией — сначала по x, потом по y (--no-blend отключает).
function blendSeams(px, n) {
  const band = n / 4;
  const wgt = (t) => { const d = Math.min(t, n - 1 - t) / band; return d >= 1 ? 1 : d * d * (3 - 2 * d); };
  const pass = (src, horizontal) => {
    const dst = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const k = wgt(horizontal ? x : y);
      const sx = horizontal ? (x + n / 2) % n : x, sy = horizontal ? y : (y + n / 2) % n;
      dst[y * n + x] = src[y * n + x] * k + src[sy * n + sx] * (1 - k);
    }
    return dst;
  };
  return pass(pass(px, true), false);
}

async function texture(id, src) {
  const gray = await sharp(src.path).rotate().flatten({ background: '#000' }).grayscale()
    .resize(TILE, TILE, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    .raw().toBuffer();
  let px = Float32Array.from(gray);
  if (!noBlend) px = blendSeams(px, TILE);
  const buf = Buffer.from(Uint8Array.from(px, (v) => Math.round(v)));
  let mean = 0;
  for (const v of buf) mean += v;
  mean /= buf.length;
  await sharp(buf, { raw: { width: TILE, height: TILE, channels: 1 } })
    .webp({ quality: 80, effort: 5 })
    .toFile(`${OUT_TEXTURES}/${id}.webp`);
  const hint = mean > 110 ? ' — светловато для тёмной фактуры' : '';
  console.log(`  ${id}: ${src.name} → ${TILE}×${TILE}${noBlend ? '' : ', швы сглажены'}, средняя яркость ${mean.toFixed(0)}${hint}`);
}

// в data/*.json правим строки как текст, чтобы не трогать форматирование
async function relink(ids) {
  if (!ids.length) return;
  for (const name of (await readdir('data')).filter((f) => f.endsWith('.json')).sort()) {
    const path = `data/${name}`;
    const before = await readFile(path, 'utf8');
    let after = before, count = 0;
    for (const id of ids) {
      after = after.replaceAll(`assets/collage/${id}.svg`, () => { count++; return `assets/collage/${id}.webp`; });
    }
    if (count) {
      await writeFile(path, after);
      console.log(`  ${path}: ${count} путей .svg → .webp`);
    }
  }
}

const collageSrc = await sources(RAW_COLLAGE, ['png', 'webp', 'jpg', 'jpeg']);
const textureSrc = await sources(RAW_TEXTURES, ['png', 'jpg', 'jpeg']);
if (!collageSrc.size && !textureSrc.size) {
  console.warn(`Нет картинок в ${RAW_COLLAGE}/ и ${RAW_TEXTURES}/${only.length ? ` для ${only.join(', ')}` : ''}.`);
}

const done = [];
if (collageSrc.size) {
  await mkdir(OUT_COLLAGE, { recursive: true });
  console.log('коллаж:');
  for (const [id, src] of collageSrc) if (await collage(id, src)) done.push(id);
  await relink(done);
}
if (textureSrc.size) {
  await mkdir(OUT_TEXTURES, { recursive: true });
  console.log('фактуры:');
  for (const [id, src] of textureSrc) await texture(id, src);
}
