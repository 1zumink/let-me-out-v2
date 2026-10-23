import './styles/base.css';
import './styles/layers.css';
import './styles/games.css';
import { places, heroSpec, quotes, scenes, ui, webring, type Line } from './data';
import { createStore, type Lap } from './state';
import { storage, LAP_KEY } from './storage';
import { memory } from './memory';
import { mulberry32, seedFromUrl } from './rng';
import { createInput } from './input';
import { motion, mountLive, focus } from './a11y';
import { Hero } from './hero/hero';
import { h } from './dom';
import { ExitButton } from './ui/ExitButton';
import { PauseButton } from './ui/PauseButton';
import { ExitScreen } from './ui/ExitScreen';
import { Intro } from './ui/Intro';
import { WallQuote } from './ui/WallQuote';
import { createBubbles } from './ui/SpeechBubble';
import { floorModules } from './floors';
import { Atmosphere, FilterDefs, Grain } from './scene/Atmosphere';
import { startBoilClock } from './scene/boil';
import { createSideScenes } from './scenes/sideScenes';
import type { Floor, FloorCtx, Hint } from './floors/types';

const HINT_MS = 20000;
const CAMERA_MS = 1400;

const seed = seedFromUrl(location.search);
document.documentElement.dataset.seed = String(seed);
const rng = mulberry32(seed);
// ?floor=N — начать с места N (0–11; для отладки и показа)
const floorParam = Number(new URLSearchParams(location.search).get('floor'));
const startAt = Number.isInteger(floorParam) && floorParam > 0 && floorParam < places.length ? floorParam : 0;
const store = createStore({ lap: (storage.get(LAP_KEY) === '2' ? 2 : 1) as Lap, floor: startAt });

// ── сцена ─────────────────────────────────────────────
const app = document.getElementById('app')!;
const world = h('div.world');
const heroLayer = h('div.hero-layer');
const lightEl = h('div.light', { 'aria-hidden': 'true' });
const bubblesLayer = h('div.bubbles');
const hintEl = h('p.hint', { 'aria-live': 'polite' });
const controls = h('div.controls');
const upBtn = h('button.btn.btn--up', { type: 'button', hidden: true, title: ui.upHint }, ui.up);
const status = h('p.status');
const scenesLayer = h('div.scenes');
const finale = h('div.finale', { hidden: true });
const restartBtn = h('button.btn.btn--small', { type: 'button' }, ui.restart);
const footer = h('footer.stage-footer', { hidden: true }, restartBtn);
const exitScreen = ExitScreen(ui, webring, { onClose: closeExit, onAgain: againFromStart, onRestart: restartFromZero });
const intro = Intro(ui, startStory);

const stage = h(
  'main.stage',
  {},
  h('h1.sr-only', {}, ui.title),
  Atmosphere(),
  world,
  heroLayer,
  lightEl,
  Grain(),
  bubblesLayer,
  scenesLayer,
  finale,
  // док раньше HUD: Tab ведёт сначала по игре, потом к «пауза» и «уйти»
  h('div.dock', {}, hintEl, controls, upBtn, footer),
  h('div.hud', {}, status, h('div.hud__corner', {}, PauseButton(ui), ExitButton(ui, openExit))),
);
stage.append(intro.el);
app.append(FilterDefs(), stage, exitScreen.el);
mountLive(app);
motion.init();
startBoilClock();

// игровая область кончается над доком с кнопками, чтобы они не закрывали героя
const dock = stage.querySelector<HTMLElement>('.dock')!;
new ResizeObserver(() => stage.style.setProperty('--dock-space', `${dock.offsetHeight}px`)).observe(dock);

const hero = new Hero(heroSpec, import.meta.env.BASE_URL);
heroLayer.append(hero.el);
const bubbles = createBubbles(bubblesLayer);
bubbles.speaker('hero', hero.el);
const input = createInput(stage);
const sideScenes = createSideScenes({ layer: scenesLayer, store, scenes, rng, ui });
// «начать с нуля» в футере — когда есть что сбрасывать (второй круг)
store.subscribe((s) => (footer.hidden = s.lap !== 2));
footer.hidden = store.get().lap !== 2;

// ── места ─────────────────────────────────────────────
interface Current {
  floor: Floor;
  slot: HTMLElement;
  ac: AbortController;
  ctx: FloorCtx;
}
let current: Current | null = null;
/** Что делает «выше» вместо подъёма (после финала первого круга — второй круг). */
let upAction: (() => void) | null = null;

const waitFor = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const id = window.setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(id), resolve()), { once: true });
  });

function makeHint(signal: AbortSignal): Hint {
  let timer = 0;
  // через 20 с бездействия инструкция мягко подсвечивается
  const calm = () => {
    clearTimeout(timer);
    hintEl.classList.remove('is-nudge');
  };
  const poke = () => {
    calm();
    if (signal.aborted) return;
    timer = window.setTimeout(() => hintEl.classList.add('is-nudge'), HINT_MS);
  };
  signal.addEventListener('abort', calm, { once: true });
  return { poke, stop: calm };
}

function makeCtx(slot: HTMLElement, index: number, ac: AbortController): FloorCtx {
  const data = places[index];
  const lap = store.get().lap;
  const signal = ac.signal;
  const pick = <T,>(key: string): T | undefined => {
    const own = lap === 2 ? (data.lines.lap2?.[key] as T | undefined) : undefined;
    return own ?? (data.lines.lap1[key] as T | undefined);
  };
  return {
    el: slot,
    controls,
    data,
    lap,
    hero,
    rng,
    ui,
    signal,
    after(ms, fn) {
      const id = window.setTimeout(() => !signal.aborted && fn(), ms);
      signal.addEventListener('abort', () => clearTimeout(id), { once: true });
    },
    wait: (ms) => waitFor(ms, signal),
    on(action, fn) {
      const off = input.on(action, fn);
      signal.addEventListener('abort', () => off(), { once: true });
    },
    say: (lines) => bubbles.say(lines, signal),
    lines: (key) => pick<Line[]>(key) ?? [],
    get: pick,
    speaker(name, el) {
      bubbles.speaker(name, el);
      if (el) signal.addEventListener('abort', () => bubbles.speaker(name, null), { once: true });
    },
    hint: () => makeHint(signal),
    light(x, y, r = 34, instant = false) {
      if (instant) {
        lightEl.classList.add('is-instant');
        requestAnimationFrame(() => requestAnimationFrame(() => lightEl.classList.remove('is-instant')));
      }
      lightEl.style.setProperty('--lx', `${x}%`);
      lightEl.style.setProperty('--ly', `${y}%`);
      lightEl.style.setProperty('--lr', `${r}vmax`);
    },
    done: () => onDone(index, ac),
  };
}

function teardown(c: Current | null) {
  if (!c) return;
  c.ac.abort();
  c.floor.unmount();
  c.slot.remove();
  controls.replaceChildren();
  hintEl.textContent = '';
}

async function enterFloor({ travel }: { travel: boolean }) {
  const index = store.get().floor;
  const data = places[index];
  const lap = store.get().lap;
  const ac = new AbortController();
  const slot = h('section.floor', { 'aria-label': data.label });
  slot.style.setProperty('--i', String(index));
  world.append(slot);
  const ctx = makeCtx(slot, index, ac);
  const floor = (floorModules[data.module] ?? floorModules.game)();
  floor.mount(ctx);

  const prev = current;
  current = { floor, slot, ac, ctx };
  status.textContent = `${data.label} · ${ui.lapLabel} ${lap}`;
  world.classList.toggle('is-cut', !travel);
  world.style.setProperty('--floor', String(index));
  if (travel && !motion.reduced()) await waitFor(CAMERA_MS, ac.signal);
  teardown(prev);
  if (ac.signal.aborted) return;

  floor.arrive?.();
  const silence = lap === 2 ? ctx.get<number>('silenceMs') : undefined;
  if (silence) await ctx.wait(silence);
  await ctx.say(floor.enterLines?.() ?? ctx.lines('enter'));
  if (ac.signal.aborted) return;
  const playing = (floor.hasGame?.() ?? !!data.game) && store.phase('play');
  if (playing && data.game) hintEl.textContent = (ui.instructions as Record<string, string>)[data.game] ?? '';
  floor.start();
}

/** Картинки следующего места грузим заранее, пока игрок стоит на этом. */
function prefetch(index: number) {
  const p = places[index];
  const srcs = [...(p?.collage ?? []).map((c) => c.src)];
  for (const src of srcs) new Image().src = import.meta.env.BASE_URL + src;
}

/** Сноска этажа — надпись на стене, которая проявляется в свете. */
function showQuote(c: Current, layer?: HTMLElement) {
  const q = quotes.find((it) => it.id === c.ctx.data.quote);
  if (!q) return null;
  const [hx] = hero.position;
  const x = layer ? 50 : hx > 50 ? 30 : 70;
  const y = layer ? 42 : 34;
  const wq = WallQuote(q, { x, y, rng });
  (layer ?? c.slot).append(wq.el);
  if (!layer) c.ctx.light(x, y, 32);
  c.ctx.after(700, () => wq.light());
  return wq;
}

async function onDone(index: number, ac: AbortController) {
  if (ac.signal.aborted || store.get().floor !== index || !store.phase('stop')) return;
  const c = current!;
  const data = places[index];
  const lap = store.get().lap;
  c.floor.stop();
  controls.replaceChildren();
  hintEl.textContent = '';
  prefetch(index + 1);
  await c.ctx.say(c.ctx.lines('done'));
  if (ac.signal.aborted) return;

  if (data.final) return finish(c, lap);

  showQuote(c);
  c.floor.rest?.();
  sideScenes.maybeShow(data.id);
  upBtn.textContent = data.upLabel ?? ui.up;
  upBtn.hidden = false;
  focus(upBtn);
}

/** Финал. Первый круг: падение, темнота, сноска — и второй круг. Второй: финальный экран. */
async function finish(c: Current, lap: Lap) {
  storage.set(LAP_KEY, '2');
  footer.hidden = false;
  if (lap === 2) {
    await c.ctx.wait(1600);
    if (!c.ac.signal.aborted) openExit();
    return;
  }
  stage.classList.add('is-dark');
  finale.hidden = false;
  await c.ctx.wait(motion.reduced() ? 300 : 2200);
  showQuote(c, finale);
  upAction = () => restart(2);
  upBtn.textContent = ui.up;
  upBtn.hidden = false;
  focus(upBtn);
}

function goUp() {
  const s = store.get();
  if (intro.isOpen) return startStory();
  if (exitScreen.isOpen) return;
  if (s.phase !== 'stop' || upBtn.hidden) return;
  if (upAction) return upAction();
  if (s.floor >= places.length - 1) return;
  upBtn.hidden = true;
  bubbles.clear();
  sideScenes.close();
  store.phase('exit');
  hero.reset();
  hero.set('climb');
  store.nextFloor();
  enterFloor({ travel: true });
}

function restart(lap: Lap) {
  upBtn.hidden = true;
  upAction = null;
  stage.classList.remove('is-dark');
  finale.replaceChildren();
  finale.hidden = true;
  bubbles.clear();
  sideScenes.reset();
  const prev = current;
  current = null;
  teardown(prev);
  store.restart(lap);
  hero.reset();
  enterFloor({ travel: false });
}

function startStory() {
  if (!intro.isOpen) return;
  intro.close();
  enterFloor({ travel: false });
}

// ── выход ─────────────────────────────────────────────
function openExit() {
  stage.inert = true;
  exitScreen.open();
}
function closeExit() {
  exitScreen.close();
  stage.inert = false;
  focus(stage.querySelector<HTMLElement>(intro.isOpen ? '.intro .btn' : '.btn--exit'));
}
function againFromStart() {
  closeExit();
  if (intro.isOpen) intro.close();
  restart(store.get().lap);
}
function restartFromZero() {
  storage.remove(LAP_KEY);
  memory.reset();
  closeExit();
  if (intro.isOpen) intro.close();
  restart(1);
}

upBtn.addEventListener('click', goUp);
input.on('up', goUp);
input.on('escape', () => {
  if (exitScreen.isOpen) closeExit();
  else if (sideScenes.isOpen) sideScenes.close();
  else bubbles.skip();
});
restartBtn.addEventListener('click', restartFromZero);

// ?floor=N пропускает первый экран
if (startAt > 0) {
  intro.close();
  enterFloor({ travel: false });
} else intro.open();

// офлайн после первой загрузки (только в сборке: в dev кеш мешал бы правкам)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    /* без service worker история работает так же, просто без офлайна */
  });
}
