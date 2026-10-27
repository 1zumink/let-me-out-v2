// Проверяет, что каждая лента героя имеет ширину frames×256 и высоту 256.
import sharp from 'sharp';
import { readFile, access } from 'node:fs/promises';

const hero = JSON.parse(await readFile('data/hero.json', 'utf8'));
const exists = (p) => access(p).then(() => true, () => false);
let bad = 0;
const missing = [];
for (const [state, { frames }] of Object.entries(hero)) {
  for (const ext of ['png', 'webp']) {
    const p = `public/assets/hero/${state}.${ext}`;
    if (!(await exists(p))) { missing.push(p); continue; }
    const { width, height } = await sharp(p).metadata();
    const ok = width === frames * 256 && height === 256;
    if (!ok) bad++;
    console.log(`${ok ? '✓' : '✗'} ${p}: ${width}×${height}${ok ? '' : `, ожидалось ${frames * 256}×256`}`);
  }
}
if (missing.length) console.log(`\nНе хватает (герой покажет SVG-заглушку):\n  ${missing.join('\n  ')}`);
if (!hero.ghost) console.log('ghost — отдельный файл не нужен (idle + пунктир в CSS).');
if (bad) process.exit(1);
