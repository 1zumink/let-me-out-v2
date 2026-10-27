// Проверка data/*.json перед dev и build. Цитата (сноска) без source — ошибка сборки.
import { readFile } from 'node:fs/promises';

const read = async (name) => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), 'utf8'));
const isStr = (v) => typeof v === 'string' && v.trim() !== '';

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
    for (const k of ['translator', 'page', 'by', 'note']) if (k in q && typeof q[k] !== 'string') out.push(`${at}: ${k} должен быть строкой`);
  });
  return out;
}

const isLine = (l) => isStr(l) || (l && typeof l === 'object' && isStr(l.text));
function checkLines(at, v, out) {
  if (Array.isArray(v)) {
    v.forEach((l, i) => {
      if (Array.isArray(l)) checkLines(`${at}[${i}]`, l, out);
      else if (!isLine(l)) out.push(`${at}[${i}]: реплика — строка или { who, text }`);
    });
  } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) checkLines(`${at}.${k}`, x, out);
}

function checkSteps(at, steps, out) {
  if (!Array.isArray(steps)) return out.push(`${at}: steps должен быть массивом`);
  steps.forEach((st, i) => {
    const here = `${at}[${i}]`;
    if (st && Array.isArray(st.choice)) {
      st.choice.forEach((c, j) => {
        if (!isStr(c.label)) out.push(`${here}.choice[${j}]: нет label`);
        checkSteps(`${here}.choice[${j}].steps`, c.steps ?? [], out);
      });
      if (st.otherwise) checkSteps(`${here}.otherwise`, st.otherwise, out);
    } else if (!st || !isStr(st.text)) out.push(`${here}: шаг — { who, text } или { choice }`);
  });
}

export function validateScenes(scenes, placeIds = null) {
  const out = [];
  if (!Array.isArray(scenes)) return ['scenes.json: должен быть массив'];
  const ids = new Set(scenes.map((s) => s?.id));
  const seen = new Set();
  scenes.forEach((s, i) => {
    const at = `scenes.json[${i}]${s?.id ? ` (${s.id})` : ''}`;
    if (!isStr(s?.id)) out.push(`${at}: нет id`);
    else if (seen.has(s.id)) out.push(`${at}: повтор id`);
    seen.add(s?.id);
    if (!Array.isArray(s?.laps) || !s.laps.length || s.laps.some((l) => l !== 1 && l !== 2)) out.push(`${at}: laps — [1], [2] или [1, 2]`);
    if (s?.pairOf != null && !ids.has(s.pairOf)) out.push(`${at}: pairOf ссылается на несуществующую сцену ${s.pairOf}`);
    if (s?.pairOf === s?.id) out.push(`${at}: сцена не может быть парой самой себе`);
    if (placeIds) {
      if (!Array.isArray(s?.where) || !s.where.length) out.push(`${at}: нужен where — список мест`);
      else for (const w of s.where) if (!placeIds.has(w)) out.push(`${at}: where — нет места ${w}`);
      if (s?.after && !placeIds.has(s.after)) out.push(`${at}: after — нет места ${s.after}`);
      checkSteps(`${at}.steps`, s?.steps, out);
      // постановка: говорить может только актёр сцены или герой
      const actors = s?.stage?.actors;
      if (!actors || typeof actors !== 'object') out.push(`${at}: нужен stage.actors`);
      else {
        const kinds = ['stick', 'creature', 'cutout', 'sign', 'note', 'voice'];
        for (const [id, a] of Object.entries(actors)) if (!kinds.includes(a?.kind)) out.push(`${at}: актёр ${id} — неизвестный kind ${a?.kind}`);
        const who = (steps) => (steps ?? []).flatMap((st) => (st.choice ? st.choice.flatMap((c) => who(c.steps)).concat(who(st.otherwise)) : [st.who]));
        for (const w of who(s.steps)) if (w !== 'hero' && !(w in actors)) out.push(`${at}: говорит «${w}», а такого актёра в stage нет`);
      }
    }
  });
  return out;
}

export function validatePassages(pool) {
  const out = [];
  if (!pool || !Array.isArray(pool.items) || !pool.items.length) return ['passages.json: нужен непустой items'];
  if (!Array.isArray(pool.outro)) out.push('passages.json: outro — массив реплик');
  const ids = new Set();
  pool.items.forEach((it, i) => {
    const at = `passages.json.items[${i}]${it?.id ? ` (${it.id})` : ''}`;
    if (!isStr(it?.id)) out.push(`${at}: нет id`);
    else if (ids.has(it.id)) out.push(`${at}: повтор id`);
    ids.add(it?.id);
    for (const k of ['label', 'src', 'line']) if (!isStr(it?.[k])) out.push(`${at}: нет ${k}`);
    if (!(it?.w > 0)) out.push(`${at}: нужна ширина w`);
  });
  // 4–5 проходов за круг без повторов
  if (pool.items.length < 5) out.push('passages.json: для 4–5 проходов за круг нужно хотя бы 5 вещей');
  return out;
}

const GAMES = ['hold', 'breathe', 'remove', 'flap', 'ghost', 'letgo'];
export function validatePlaces(places, quoteIds) {
  const out = [];
  if (!Array.isArray(places) || !places.length) return ['floors.json: нужен непустой массив мест'];
  const ids = new Set();
  places.forEach((p, i) => {
    const at = `floors.json[${i}]${p?.id ? ` (${p.id})` : ''}`;
    if (!isStr(p.id)) out.push(`${at}: нет id`);
    else if (ids.has(p.id)) out.push(`${at}: повтор id`);
    ids.add(p.id);
    if (p.kind !== 'floor' && p.kind !== 'passage') out.push(`${at}: kind — floor или passage`);
    if (!isStr(p.label) || !isStr(p.module)) out.push(`${at}: нужны label и module`);
    if (p.game !== null && !GAMES.includes(p.game)) out.push(`${at}: неизвестная игра ${p.game}`);
    if (!p.lines?.lap1 || typeof p.lines.lap1 !== 'object') out.push(`${at}: нужен lines.lap1`);
    else checkLines(`${at}.lines`, p.lines, out);
    if (p.quote != null && !quoteIds.has(p.quote)) out.push(`${at}: сноска ${p.quote} не найдена в quotes.json (или у неё нет source)`);
    (p.collage ?? []).forEach((c, j) => {
      if (!isStr(c.id) || !isStr(c.label) || !isStr(c.src)) out.push(`${at}.collage[${j}]: нужны id, label, src`);
    });
  });
  if (!places.some((p) => p.final)) out.push('floors.json: нет финального места (final: true)');
  return out;
}

async function main() {
  const errors = [];
  const todos = [];
  const scanTodo = (where, v) => {
    if (typeof v === 'string' && v.includes('TODO')) todos.push(where);
    else if (Array.isArray(v)) v.forEach((x, i) => scanTodo(`${where}[${i}]`, x));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => scanTodo(`${where}.${k}`, x));
  };
  const [places, scenes, quotes, credits, webring, hero, ui, passages] = await Promise.all(
    ['floors.json', 'scenes.json', 'quotes.json', 'credits.json', 'webring.json', 'hero.json', 'ui.json', 'passages.json'].map(read),
  );
  errors.push(...validateQuotes(quotes));
  const quoteIds = new Set(quotes.filter((q) => isStr(q.source)).map((q) => q.id));
  errors.push(...validatePlaces(places, quoteIds));
  errors.push(...validatePassages(passages));
  // в where сцен — id этажей и уступа или тег passage (случайный проход)
  errors.push(...validateScenes(scenes, new Set([...places.map((p) => p.id), 'passage'])));
  if (!Array.isArray(credits)) errors.push('credits.json: должен быть массив');
  for (const k of ['prev', 'next']) if (!isStr(webring?.[k]?.title) || !isStr(webring?.[k]?.url)) errors.push(`webring.json: нужен ${k}.title и ${k}.url`);
  for (const [k, v] of Object.entries(hero)) {
    if (!(v.frames >= 1 && v.fps > 0 && typeof v.loop === 'boolean')) errors.push(`hero.json: ${k} — нужны frames, fps, loop`);
    if (v.align !== undefined && v.align !== 'feet' && v.align !== 'top') errors.push(`hero.json: ${k}.align — feet или top`);
  }
  for (const p of places) if (p.game && !isStr(ui.instructions?.[p.game])) errors.push(`ui.json: нет инструкции для игры ${p.game}`);

  for (const [name, v] of Object.entries({ floors: places, scenes, quotes, credits, webring, ui, passages })) scanTodo(name, v);
  if (todos.length) console.warn(`data: ${todos.length} строк с TODO:\n  ${todos.join('\n  ')}`);
  if (errors.length) {
    console.error('Ошибки в data/:\n  ' + errors.join('\n  '));
    process.exit(1);
  }
  console.log('data: ок');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
