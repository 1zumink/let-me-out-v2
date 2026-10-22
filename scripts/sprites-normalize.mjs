// Сырые ленты ChatGPT (raw/hero/<state>.png) → ровные ленты frames×256 (public/assets/hero).
// Фон часто нарисован «шахматкой» без альфы: линия героя тёплая (r > b), шахматка нейтральная.
import sharp from 'sharp';
import { readFile, mkdir, access } from 'node:fs/promises';

const FRAME = 256;
const FEET_Y = 236;
const HERO_H = 200; // высота стоящего героя (idle) в кадре
const RAW = 'raw/hero';
const OUT = 'public/assets/hero';

const hero = JSON.parse(await readFile('data/hero.json', 'utf8'));
const only = process.argv.slice(2);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

async function load(state) {
  const { data, info } = await sharp(`${RAW}/${state}.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3] / 255;
    const warm = clamp01((r - b - 5) / 8);
    const lum = clamp01(((r + g + b) / 3 - 150) / 40);
    alpha[i] = a * warm * lum;
  }
  despeckle(alpha, w, h);
  return { w, h, alpha };
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
  // перекрашиваем в фирменный цвет линии, чтобы убрать блики и грязь
  const rgba = Buffer.alloc(fw * fh * 4);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const sx = minX - 2 + x, sy = minY - 2 + y;
    if (!mask[y * fw + x] || sx < 0 || sy < 0 || sx >= w || sy >= img.h) continue;
    const o = (y * fw + x) * 4;
    rgba[o] = 0xe8; rgba[o + 1] = 0xe4; rgba[o + 2] = 0xdc;
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
  const { frames } = await measure(state);
  const maxH = Math.max(...frames.filter(Boolean).map((f) => f.height));
  const maxW = Math.max(...frames.filter(Boolean).map((f) => f.width));
  const scale = Math.min(scaleBase, (FEET_Y - 4) / maxH, (FRAME - 8) / maxW);
  const layers = [];
  for (let i = 0; i < n; i++) {
    const f = frames[i];
    if (!f) { console.warn(`  ${state}: кадр ${i + 1} пустой`); continue; }
    const w = Math.max(1, Math.round(f.width * scale));
    const h = Math.max(1, Math.round(f.height * scale));
    const input = await sharp(f.rgba, { raw: { width: f.width, height: f.height, channels: 4 } })
      .resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
    layers.push({ input, left: i * FRAME + Math.round((FRAME - w) / 2), top: FEET_Y - h });
  }
  const buf = await sharp({ create: { width: n * FRAME, height: FRAME, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers).png().toBuffer();
  await sharp(buf).png({ compressionLevel: 9 }).toFile(`${OUT}/${state}.png`);
  await sharp(buf).webp({ quality: 85, alphaQuality: 90 }).toFile(`${OUT}/${state}.webp`);
  console.log(`  ${state}: ${n} кадров, масштаб ${scale.toFixed(3)}`);
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
