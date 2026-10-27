// Сырые ленты ChatGPT (raw/hero/<state>.png) → ровные ленты frames×256 (public/assets/hero).
// Фон часто нарисован «шахматкой» без альфы: линия героя тёплая (r > b), шахматка нейтральная.
import sharp from 'sharp';
import { readFile, mkdir, access } from 'node:fs/promises';

const FRAME = 256;
const FEET_Y = 236;
const HANDS_Y = 16; // висящие состояния (align: "top") выравниваются по рукам у верха кадра
const HERO_H = 200; // высота стоящего героя (idle) в кадре
const RAW = 'raw/hero';
const OUT = 'public/assets/hero';

const hero = JSON.parse(await readFile('data/hero.json', 'utf8'));
// --still palm: одиночная картинка линией героя (raw/collage/<id>.png → public/assets/collage/<id>.webp), без обводки вырезок
const still = process.argv.includes('--still');
const only = process.argv.slice(2).filter((a) => a !== '--still');
const STILL_MAX = 480;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

async function load(state, file = `${RAW}/${state}.png`) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const alpha = new Float32Array(w * h);
  // color: true — цветной рисунок (другой человечек): цвета не трогаем, прозрачность — из файла или
  // заливкой от краёв по нарисованной серой «шахматке»
  if (hero[state]?.color) {
    let opaque = 0;
    for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] > 250) opaque++;
    if (opaque < w * h * 0.95) for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3] / 255;
    else checkerAlpha(data, w, h, alpha);
    despeckle(alpha, w, h);
    return { w, h, alpha, rgb: data };
  }
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3] / 255;
    const warm = clamp01((r - b - 5) / 8);
    const lum = clamp01(((r + g + b) / 3 - 150) / 40);
    alpha[i] = a * warm * lum;
  }
  despeckle(alpha, w, h);
  return { w, h, alpha };
}

// фон без альфы: заливка от краёв по светлым почти серым пикселям; тело, контур и шапку не трогает
function checkerAlpha(data, w, h, alpha) {
  const n = w * h;
  const bg = new Uint8Array(n);
  const isBg = (i) => {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    // клетки шахматки нейтральные, 110–200; контур человечка темнее и насыщеннее (коричневый), тело кремовое
    return Math.max(r, g, b) - Math.min(r, g, b) <= 14 && (r + g + b) / 3 >= 95;
  };
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
  for (let i = 0; i < n; i++) alpha[i] = bg[i] ? 0 : 1;
  // трещинки и пятна, нарисованные на шахматке, — мелкие островки; сам человечек — крупные
  const label = new Int32Array(n).fill(-1);
  const sizes = [];
  for (let i = 0; i < n; i++) {
    if (!alpha[i] || label[i] >= 0) continue;
    const id = sizes.length;
    let size = 0;
    label[i] = id;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop();
      size++;
      const x = j % w;
      for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j - w, j + w]) {
        if (k >= 0 && k < n && alpha[k] && label[k] < 0) { label[k] = id; stack.push(k); }
      }
    }
    sizes.push(size);
  }
  const min = Math.max(...sizes) * 0.02;
  for (let i = 0; i < n; i++) if (alpha[i] && sizes[label[i]] < min) alpha[i] = 0;
}

// красные тона (шапка, шарф) → ржавый #a5543a, единственный акцентный цвет по ТЗ; светотень сохраняется
const RUST = [0xa5, 0x54, 0x3a];
const RUST_LUM = 0.2126 * RUST[0] + 0.7152 * RUST[1] + 0.0722 * RUST[2];
function toRust(r, g, b) {
  const t = clamp01((r - Math.max(g, b) - 20) / 60);
  if (!t) return [r, g, b];
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const k = Math.min(1.05, lum / RUST_LUM);
  return [r, g, b].map((v, c) => Math.round(v + (Math.min(255, RUST[c] * k) - v) * t));
}

// убирает одиночные точки: пиксель гаснет, если у него мало непрозрачных соседей
function despeckle(alpha, w, h) {
  const src = alpha.slice();
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (src[i] < 0.1) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (src[i + dy * w + dx] > 0.3) n++;
      if (n < 4) alpha[i] = 0;
    }
  }
}

// Кадры ChatGPT стоят неровно, и крылья соседей могут заходить друг на друга по x,
// поэтому режем не по колонкам, а по связным компонентам, сгруппированным в N кадров.
function components(alpha, w, h) {
  const label = new Int32Array(w * h).fill(-1);
  const comps = [];
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (label[i] >= 0 || alpha[i] <= 0.4) continue;
    const id = comps.length;
    const c = { id, pixels: [], sumX: 0 };
    label[i] = id;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop();
      c.pixels.push(j);
      c.sumX += j % w;
      const x = j % w, y = (j / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const k = ny * w + nx;
          if (label[k] < 0 && alpha[k] > 0.4) { label[k] = id; stack.push(k); }
        }
      }
    }
    c.cx = c.sumX / c.pixels.length;
    comps.push(c);
  }
  return comps.filter((c) => c.pixels.length >= 30);
}

// взвешенный 1D k-means по центрам компонент, старт — равная сетка
function group(comps, w, n) {
  const centers = Array.from({ length: n }, (_, k) => ((k + 0.5) * w) / n);
  const nearest = (x) => centers.reduce((best, c, k) => (Math.abs(x - c) < Math.abs(x - centers[best]) ? k : best), 0);
  for (let it = 0; it < 30; it++) {
    const sum = new Array(n).fill(0), wt = new Array(n).fill(0);
    for (const c of comps) { const k = nearest(c.cx); sum[k] += c.cx * c.pixels.length; wt[k] += c.pixels.length; }
    for (let k = 0; k < n; k++) if (wt[k]) centers[k] = sum[k] / wt[k];
  }
  const order = centers.map((c, k) => [c, k]).sort((a, b) => a[0] - b[0]).map(([, k]) => k);
  const frames = Array.from({ length: n }, () => []);
  for (const c of comps) frames[order.indexOf(nearest(c.cx))].push(c);
  return frames;
}

// кадр = только свои пиксели, обрезанные по их bbox
function cutFrame(img, comps) {
  if (!comps.length) return null;
  const { w, alpha } = img;
  let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
  for (const c of comps) for (const j of c.pixels) {
    const x = j % w, y = (j / w) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  // захватываем мягкие края на 2 px вокруг своих пикселей
  const fw = maxX - minX + 5, fh = maxY - minY + 5;
  const mask = new Uint8Array(fw * fh);
  for (const c of comps) for (const j of c.pixels) {
    const x = j % w - minX + 2, y = ((j / w) | 0) - minY + 2;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const mx = x + dx, my = y + dy;
      if (mx >= 0 && my >= 0 && mx < fw && my < fh) mask[my * fw + mx] = 1;
    }
  }
  // линия героя — перекрашиваем в фирменный цвет, чтобы убрать блики и грязь; цветной рисунок — свои цвета
  const rgba = Buffer.alloc(fw * fh * 4);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const sx = minX - 2 + x, sy = minY - 2 + y;
    if (!mask[y * fw + x] || sx < 0 || sy < 0 || sx >= w || sy >= img.h) continue;
    const o = (y * fw + x) * 4;
    if (img.rgb) {
      const i = (sy * w + sx) * 4;
      [rgba[o], rgba[o + 1], rgba[o + 2]] = toRust(img.rgb[i], img.rgb[i + 1], img.rgb[i + 2]);
    } else {
      rgba[o] = 0xe8; rgba[o + 1] = 0xe4; rgba[o + 2] = 0xdc;
    }
    rgba[o + 3] = Math.round(alpha[sy * w + sx] * 255);
  }
  return { rgba, width: fw, height: fh };
}

async function measure(state) {
  const n = hero[state].frames;
  const img = await load(state);
  const frames = group(components(img.alpha, img.w, img.h), img.w, n).map((cs) => cutFrame(img, cs));
  return { frames };
}

async function build(state, scaleBase) {
  const n = hero[state].frames;
  const top = hero[state].align === 'top';
  const { frames } = await measure(state);
  const maxH = Math.max(...frames.filter(Boolean).map((f) => f.height));
  const maxW = Math.max(...frames.filter(Boolean).map((f) => f.width));
  const scale = Math.min(scaleBase, (top ? FRAME - HANDS_Y - 4 : FEET_Y - 4) / maxH, (FRAME - 8) / maxW);
  const layers = [];
  for (let i = 0; i < n; i++) {
    const f = frames[i];
    if (!f) { console.warn(`  ${state}: кадр ${i + 1} пустой`); continue; }
    const w = Math.max(1, Math.round(f.width * scale));
    const h = Math.max(1, Math.round(f.height * scale));
    const input = await sharp(f.rgba, { raw: { width: f.width, height: f.height, channels: 4 } })
      .resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
    layers.push({ input, left: i * FRAME + Math.round((FRAME - w) / 2), top: top ? HANDS_Y : FEET_Y - h });
  }
  const buf = await sharp({ create: { width: n * FRAME, height: FRAME, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers).png().toBuffer();
  await sharp(buf).png({ compressionLevel: 9 }).toFile(`${OUT}/${state}.png`);
  await sharp(buf).webp({ quality: 85, alphaQuality: 90 }).toFile(`${OUT}/${state}.webp`);
  console.log(`  ${state}: ${n} кадров, масштаб ${scale.toFixed(3)}${top ? ', по рукам' : ''}`);
}

/** Одна картинка линией: все компоненты — один кадр, тот же цвет линии, сторона не больше STILL_MAX. */
async function buildStill(id) {
  const img = await load(id, `raw/collage/${id}.png`);
  const f = cutFrame(img, components(img.alpha, img.w, img.h));
  if (!f) return console.warn(`  ${id}: пусто`);
  const k = Math.min(1, STILL_MAX / Math.max(f.width, f.height));
  await mkdir('public/assets/collage', { recursive: true });
  await sharp(f.rgba, { raw: { width: f.width, height: f.height, channels: 4 } })
    .resize(Math.round(f.width * k), Math.round(f.height * k), { kernel: 'lanczos3' })
    .webp({ quality: 88, alphaQuality: 90 })
    .toFile(`public/assets/collage/${id}.webp`);
  console.log(`  ${id}: линия → public/assets/collage/${id}.webp`);
}

if (still) {
  for (const id of only) await buildStill(id);
  process.exit(0);
}

await mkdir(OUT, { recursive: true });
const exists = async (p) => access(p).then(() => true, () => false);

// общий масштаб считаем по idle, чтобы герой был одного роста во всех состояниях
let scaleBase = 0.3;
if (await exists(`${RAW}/idle.png`)) {
  const { frames } = await measure('idle');
  scaleBase = HERO_H / Math.max(...frames.filter(Boolean).map((f) => f.height));
}

for (const state of Object.keys(hero)) {
  if (only.length && !only.includes(state)) continue;
  if (!(await exists(`${RAW}/${state}.png`))) { console.warn(`  ${state}: нет ${RAW}/${state}.png — пропуск`); continue; }
  await build(state, scaleBase);
}
