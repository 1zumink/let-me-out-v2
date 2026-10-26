// «Держи» (этажи 1 и 7): держишь — герой лезет; отпустишь — съезжает до последней остановки, не ниже.
// Удержание: на герое или в любом месте шахты (указатель), Enter/пробел на «держать»; дубль — переключатель.
import { h } from '../dom';
import { bindHold } from '../input';
import { focus, motion } from '../a11y';
import type { Line } from '../data';
import { scope, type GameFactory } from './common';

const X = 50;
const SLIDE_PER_MS = 1 / 900; // съезжает быстрее, чем лезет
const STEP = 0.25; // reduced motion: подъём и сползание ступеньками

/** Что делает герой — то и показывает поза. */
const STATE = {
  climbing: 'climb', // держат — лезет
  supported: 'held', // остановка: держат, отдыхает — висит на руке читателя, ноги свободно
  sliding: 'slip', // отпустили — съезжает
  ledge: 'hang', // съехал до выступа — висит на кромке, ноги свисают
  floor: 'idle', // внизу, на полу
  seated: 'sit', // последний широкий выступ: «посади меня тут ненадолго»
} as const;

export const createHold: GameFactory = (ctx, onDone) => {
  const s = scope(ctx);
  const { hero, ui } = ctx;
  // end: 'hang' — последний участок кончается висом за край (этаж 7, стены гладкие)
  const params = ctx.data.params as { stops: number[]; sectionMs: number; startY?: number; silent?: boolean; end?: 'hang' };
  const stopLines = ctx.get<Line[][]>('stops') ?? [];
  // остановки: промежуточные — выступы на уровне рук, последняя — широкий, на него встают
  const last = params.stops.length;
  const feetAt = (k: number) =>
    k === 0 ? params.startY ?? 84 : k === last && params.end !== 'hang' ? params.stops[k - 1] : hero.toFeet(params.stops[k - 1], 'hands');
  let section = 0; // между остановкой section и section + 1
  let progress = 0;
  let holding = false;
  let resting = false;
  let raf = 0;
  let last_ = 0;
  const hint = ctx.hint();

  const grip = s.own(
    h('div.grip.grip--hand', { role: 'button', tabindex: '0', 'aria-label': ui.holdTarget, 'aria-pressed': 'false' }, h('span.grip__arm', { 'aria-hidden': 'true' })),
  );
  const toggle = s.own(h('button.btn', { type: 'button', 'aria-pressed': 'false' }, ui.holdToggle));
  const fill = h('span.meter__fill');
  const meter = s.own(
    h('div.meter', { role: 'progressbar', 'aria-label': ui.holdProgress, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, fill),
  );

  const pose = (state: (typeof STATE)[keyof typeof STATE]) => hero.state !== state && hero.set(state);
  const restPose = () => pose(section === 0 ? STATE.floor : STATE.ledge);

  const y = () => {
    const p = motion.reduced() ? Math.floor(progress / STEP) * STEP : progress;
    return feetAt(section) + (feetAt(section + 1) - feetAt(section)) * p;
  };

  const set = (value: boolean) => {
    if (value === holding) return;
    holding = value;
    hint.poke();
    grip.setAttribute('aria-pressed', String(value));
    toggle.setAttribute('aria-pressed', String(value));
    grip.classList.toggle('is-held', value);
    if (resting) return;
    if (value) pose(STATE.climbing);
    else if (progress > 0) pose(STATE.sliding);
    else restPose();
  };

  const reach = async () => {
    resting = true;
    section++;
    progress = 0;
    hero.place(X, feetAt(section));
    ctx.light(X, feetAt(section) - 18);
    const total = (section / last) * 100;
    fill.style.transform = `scaleX(${total / 100})`;
    meter.setAttribute('aria-valuenow', String(Math.round(total)));
    pose(section < last ? STATE.supported : params.end === 'hang' ? STATE.ledge : STATE.seated);
    if (!params.silent) await ctx.say(stopLines[section - 1] ?? []);
    if (s.signal.aborted) return;
    if (section >= last) return finish();
    resting = false;
    if (holding) pose(STATE.climbing);
    else restPose();
  };

  const tick = (now: number) => {
    const dt = Math.min(now - last_, 100);
    last_ = now;
    if (!resting) {
      if (holding) progress = Math.min(1, progress + dt / params.sectionMs);
      else if (progress > 0) {
        progress = Math.max(0, progress - dt * SLIDE_PER_MS);
        if (progress === 0) restPose();
      }
      hero.place(X, y());
      const total = ((section + progress) / last) * 100;
      fill.style.transform = `scaleX(${total / 100})`;
      meter.setAttribute('aria-valuenow', String(Math.round(total / 10) * 10));
      if (progress >= 1) reach();
    }
    raf = requestAnimationFrame(tick);
  };

  const finish = () => {
    cancelAnimationFrame(raf);
    hint.stop();
    onDone();
  };

  return {
    start() {
      hint.poke();
      hero.el.classList.add('is-tracking');
      hero.place(X, feetAt(0));
      restPose();
      hero.attach(grip);
      ctx.controls.append(toggle, meter);
      const hold = { onStart: () => set(true), onEnd: () => set(false) };
      bindHold(grip, hold, s.signal);
      // держать можно в любом месте шахты
      bindHold(ctx.el, hold, s.signal);
      toggle.addEventListener('click', () => set(!holding), { signal: s.signal });
      last_ = performance.now();
      raf = requestAnimationFrame(tick);
      focus(grip);
    },
    stop() {
      cancelAnimationFrame(raf);
      hero.el.classList.remove('is-tracking');
      hint.stop();
      s.dispose();
    },
  };
};
