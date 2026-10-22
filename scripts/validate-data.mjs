// Проверка data/*.json перед dev и build. Цитата без source — ошибка сборки.
import { readFile } from 'node:fs/promises';

const read = async (name) => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), 'utf8'));
const errors = [];
const todos = [];
const err = (msg) => errors.push(msg);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const scanTodo = (where, v) => {
  if (typeof v === 'string' && v.includes('TODO')) todos.push(where);
  else if (Array.isArray(v)) v.forEach((x, i) => scanTodo(`${where}[${i}]`, x));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => scanTodo(`${where}.${k}`, x));
};

export function validateQuotes(quotes) {
  const out = [];
  if (!Array.isArray(quotes)) return ['quotes.json: должен быть массив'];
  const ids = new Set();
  quotes.forEach((q, i) => {
    const at = `quotes.json[${i}]${q?.id ? ` (${q.id})` : ''}`;
    if (!isStr(q?.id)) out.push(`${at}: нет id`);
    else if (ids.has(q.id)) out.push(`${at}: повтор id`);
    else ids.add(q.id);
    if (!isStr(q?.text)) out.push(`${at}: нет text`);
    if (!isStr(q?.author)) out.push(`${at}: нет author`);
    if (!isStr(q?.source)) out.push(`${at}: нет source — без источника цитату показывать нельзя`);
    for (const k of ['translator', 'page']) if (k in q && typeof q[k] !== 'string') out.push(`${at}: ${k} должен быть строкой`);
  });
  return out;
}

export function validateScenes(scenes) {
  const out = [];
  if (!Array.isArray(scenes)) return ['scenes.json: должен быть массив'];
  const ids = new Set(scenes.map((s) => s?.id));
  const seen = new Set();
  scenes.forEach((s, i) => {
    const at = `scenes.json[${i}]${s?.id ? ` (${s.id})` : ''}`;
    if (!isStr(s?.id)) out.push(`${at}: нет id`);
    else if (seen.has(s.id)) out.push(`${at}: повтор id`);
    seen.add(s?.id);
    if (!isStr(s?.text)) out.push(`${at}: нет text`);
    if (!Array.isArray(s?.laps) || !s.laps.length || s.laps.some((l) => l !== 1 && l !== 2)) out.push(`${at}: laps — [1], [2] или [1, 2]`);
    if (s?.pairOf != null && !ids.has(s.pairOf)) out.push(`${at}: pairOf ссылается на несуществующую сцену ${s.pairOf}`);
    if (s?.pairOf === s?.id) out.push(`${at}: сцена не может быть парой самой себе`);
  });
  return out;
}

const GAMES = ['hold', 'breathe', 'remove', 'flap', 'ghost', 'letgo'];
export function validateFloors(floors, quoteIds) {
  const out = [];
  if (!Array.isArray(floors) || !floors.length) return ['floors.json: нужен непустой массив'];
  floors.forEach((f, i) => {
    const at = `floors.json[${i}]`;
    if (f.id !== i) out.push(`${at}: id должен быть ${i}`);
    if (!isStr(f.module)) out.push(`${at}: нет module`);
    if (f.game !== null && !GAMES.includes(f.game)) out.push(`${at}: неизвестная игра ${f.game}`);
    for (const lap of ['lap1', 'lap2']) {
      const l = f.lines?.[lap];
      if (!l || !Array.isArray(l.enter) || !Array.isArray(l.done)) out.push(`${at}.lines.${lap}: нужны массивы enter и done`);
    }
    if (f.quote != null && !quoteIds.has(f.quote)) out.push(`${at}: цитата ${f.quote} не найдена в quotes.json (или у неё нет source)`);
    (f.collage ?? []).forEach((c, j) => {
      if (!isStr(c.id) || !isStr(c.label) || !isStr(c.src)) out.push(`${at}.collage[${j}]: нужны id, label, src`);
    });
  });
  if (!floors.some((f) => f.final)) out.push('floors.json: нет финального этажа (final: true)');
  return out;
}

async function main() {
  const [floors, scenes, quotes, credits, webring, hero] = await Promise.all(
    ['floors.json', 'scenes.json', 'quotes.json', 'credits.json', 'webring.json', 'hero.json'].map(read),
  );
  errors.push(...validateQuotes(quotes));
  const quoteIds = new Set(quotes.filter((q) => isStr(q.source)).map((q) => q.id));
  errors.push(...validateFloors(floors, quoteIds));
  errors.push(...validateScenes(scenes));
  if (!Array.isArray(credits)) err('credits.json: должен быть массив');
  for (const k of ['prev', 'next']) if (!isStr(webring?.[k]?.title) || !isStr(webring?.[k]?.url)) err(`webring.json: нужен ${k}.title и ${k}.url`);
  for (const [k, v] of Object.entries(hero)) if (!(v.frames >= 1 && v.fps > 0 && typeof v.loop === 'boolean')) err(`hero.json: ${k} — нужны frames, fps, loop`);
  for (const [k, v] of Object.entries(hero)) if (v.align !== undefined && v.align !== 'feet' && v.align !== 'top') err(`hero.json: ${k}.align — feet или top`);

  scanTodo('floors', floors);
  scanTodo('scenes', scenes);
  scanTodo('credits', credits);
  scanTodo('webring', webring);

  if (todos.length) console.warn(`data: ${todos.length} строк с TODO (ждут docs/text-v2.md)`);
  if (errors.length) {
    console.error('Ошибки в data/:\n  ' + errors.join('\n  '));
    process.exit(1);
  }
  console.log('data: ок');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
