import './styles/base.css';
import { floors, heroSpec, ui, webring } from './data';
import { createStore, type Lap } from './state';
import { storage, LAP_KEY } from './storage';
import { mulberry32, seedFromUrl } from './rng';
import { createInput } from './input';
import { motion, mountLive, focus } from './a11y';
import { Hero } from './hero/hero';
import { h } from './dom';
import { ExitButton } from './ui/ExitButton';
import { PauseButton } from './ui/PauseButton';
import { ExitScreen } from './ui/ExitScreen';
import { createBubbles } from './ui/SpeechBubble';
import { floorModules } from './floors';
import type { Floor, FloorCtx, Hint } from './floors/types';

const HINT_MS = 20000;
const CAMERA_MS = 1400;

const seed = seedFromUrl(location.search);
document.documentElement.dataset.seed = String(seed);
const rng = mulberry32(seed);
const store = createStore({ lap: (storage.get(LAP_KEY) === '2' ? 2 : 1) as Lap });

// ── сцена ─────────────────────────────────────────────
const app = document.getElementById('app')!;
const world = h('div.world');
const heroLayer = h('div.hero-layer');
const lightEl = h('div.light', { 'aria-hidden': 'true' });
const bubblesLayer = h('div.bubbles');
const hintEl = h('p.hint', { 'aria-live': 'polite' });
const controls = h('div.controls');
const upBtn = h('button.btn.btn--up', { type: 'button', hidden: true, title: ui.upHint }, ui.up);
const nextLapBtn = h('button.btn.btn--up', { type: 'button', hidden: true }, ui.nextLap);
const status = h('p.status');
const exitScreen = ExitScreen(ui, webring, { onBack: closeExit, onRestart: restartFromZero });

const stage = h(
  'main.stage',
  {},
  h('h1.sr-only', {}, ui.title),
  h('div.bg', { 'aria-hidden': 'true' }),
  world,
  heroLayer,
  lightEl,
  bubblesLayer,
  h('div.hud', {}, status, h('div.hud__corner', {}, PauseButton(ui), ExitButton(ui, openExit))),
  h('div.dock', {}, hintEl, controls, upBtn, nextLapBtn),
);
app.append(stage, exitScreen.el);
mountLive(app);
motion.init();

const hero = new Hero(heroSpec, import.meta.env.BASE_URL);
heroLayer.append(hero.el);
const bubbles = createBubbles(bubblesLayer);
const input = createInput(stage);

// ── этажи ─────────────────────────────────────────────
interface Current {
  floor: Floor;
  slot: HTMLElement;
  ac: AbortController;
  ctx: FloorCtx;
}
let current: Current | null = null;

function makeHint(text: string, signal: AbortSignal): Hint {
  let timer = 0;
  const hide = () => {
    clearTimeout(timer);
    hintEl.textContent = '';
  };
  const poke = () => {
    hide();
    if (!text || signal.aborted) return;
    timer = window.setTimeout(() => (hintEl.textContent = text), HINT_MS);
  };
  signal.addEventListener('abort', hide, { once: true });
  poke();
  return { poke, stop: hide };
}

function makeCtx(slot: HTMLElement, index: number, ac: AbortController): FloorCtx {
  const data = floors[index];
  const lap = store.get().lap;
  const signal = ac.signal;
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
    say: (lines) => bubbles.say(lines, hero, signal),
    lines: (key) => data.lines[lap === 2 ? 'lap2' : 'lap1'][key] ?? [],
    hint: () => makeHint(data.hint ?? '', signal),
    light(x, y, r = 34) {
      lightEl.style.setProperty('--lx', `${x}%`);
      lightEl.style.setProperty('--ly', `${y}%`);
      lightEl.style.setProperty('--lr', `${r}vmax`);
    },
    done: () => onDone(index, ac),
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function teardown(c: Current | null) {
  if (!c) return;
  c.ac.abort();
  c.floor.unmount();
  c.slot.remove();
  controls.replaceChildren();
}

async function enterFloor({ travel }: { travel: boolean }) {
  const index = store.get().floor;
  const data = floors[index];
  const ac = new AbortController();
  const slot = h('section.floor', { 'aria-label': `${ui.floorLabel} ${data.id}` });
  slot.style.setProperty('--i', String(index));
  world.append(slot);
  const ctx = makeCtx(slot, index, ac);
  const floor = (floorModules[data.module] ?? floorModules.game)();
  floor.mount(ctx);

  const prev = current;
  current = { floor, slot, ac, ctx };
  status.textContent = `${ui.floorLabel} ${data.id} · ${ui.lapLabel} ${store.get().lap}`;
  world.classList.toggle('is-cut', !travel);
  world.style.setProperty('--floor', String(index));
  if (travel && !motion.reduced()) await wait(CAMERA_MS);
  teardown(prev);
  if (ac.signal.aborted) return;

  floor.arrive?.();
  await ctx.say(ctx.lines('enter'));
  if (ac.signal.aborted) return;
  if (data.game && store.phase('play')) floor.start();
  else ctx.done();
}

async function onDone(index: number, ac: AbortController) {
  if (ac.signal.aborted || store.get().floor !== index || !store.phase('stop')) return;
  const data = floors[index];
  current?.floor.stop();
  controls.replaceChildren();
  if (current) await current.ctx.say(current.ctx.lines('done'));
  if (ac.signal.aborted) return;
  if (data.final) {
    storage.set(LAP_KEY, '2');
    nextLapBtn.hidden = false;
    focus(nextLapBtn);
  } else {
    upBtn.hidden = false;
    focus(upBtn);
  }
}

function goUp() {
  const s = store.get();
  if (s.phase !== 'stop' || s.floor >= floors.length - 1 || exitScreen.isOpen) return;
  upBtn.hidden = true;
  bubbles.clear();
  store.phase('exit');
  hero.reset();
  hero.set('climb');
  store.nextFloor();
  enterFloor({ travel: true });
}

function restart(lap: Lap) {
  upBtn.hidden = nextLapBtn.hidden = true;
  bubbles.clear();
  const prev = current;
  current = null;
  teardown(prev);
  store.restart(lap);
  hero.reset();
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
  focus(stage.querySelector<HTMLElement>('.btn--exit'));
}
function restartFromZero() {
  storage.remove(LAP_KEY);
  closeExit();
  restart(1);
}

upBtn.addEventListener('click', goUp);
nextLapBtn.addEventListener('click', () => restart(2));
input.on('up', goUp);
input.on('escape', () => (exitScreen.isOpen ? closeExit() : bubbles.skip()));

enterFloor({ travel: false });
