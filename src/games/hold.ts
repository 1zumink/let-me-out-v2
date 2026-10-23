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

export const createHold: GameFactory = (ctx, onDone) => {
  const s = scope(ctx);
  const { hero, ui } = ctx;
  const params = ctx.data.params as { stops: number[]; sectionMs: number; startY?: number; silent?: boolean };
  const stops = [params.startY ?? 84, ...params.stops];
  const stopLines = ctx.get<Line[][]>('stops') ?? [];
  let section = 0; // между stops[section] и stops[section + 1]
  let progress = 0;
  let holding = false;
  let resting = false;
  let raf = 0;
  let last = 0;
  const hint = ctx.hint();

  const grip = s.own(
    h('div.grip.grip--hand', { role: 'button', tabindex: '0', 'aria-label': ui.holdTarget, 'aria-pressed': 'false' }, h('span.grip__arm', { 'aria-hidden': 'true' })),
  );
  const toggle = s.own(h('button.btn', { type: 'button', 'aria-pressed': 'false' }, ui.holdToggle));
  const fill = h('span.meter__fill');
  const meter = s.own(
    h('div.meter', { role: 'progressbar', 'aria-label': ui.holdProgress, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, fill),
  );

  const y = () => {
    const p = motion.reduced() ? Math.floor(progress / STEP) * STEP : progress;
    return stops[section] + (stops[section + 1] - stops[section]) * p;
  };

  const set = (value: boolean) => {
    if (value === holding) return;
    holding = value;
    hint.poke();
    grip.setAttribute('aria-pressed', String(value));
    toggle.setAttribute('aria-pressed', String(value));
    grip.classList.toggle('is-held', value);
    if (resting) return;
    hero.set(value ? 'climb' : progress > 0 ? 'slip' : 'idle');
  };

  const reach = async () => {
    resting = true;
    section++;
    progress = 0;
    hero.set('idle');
    hero.place(X, stops[section]);
    ctx.light(X, stops[section] - 18);
    const total = (section / (stops.length - 1)) * 100;
    fill.style.transform = `scaleX(${total / 100})`;
    meter.setAttribute('aria-valuenow', String(Math.round(total)));
    if (!params.silent) await ctx.say(stopLines[section - 1] ?? []);
    if (s.signal.aborted) return;
    if (section >= stops.length - 1) return finish();
    resting = false;
    hero.set(holding ? 'climb' : 'idle');
  };

  const tick = (now: number) => {
    const dt = Math.min(now - last, 100);
    last = now;
    if (!resting) {
      if (holding) progress = Math.min(1, progress + dt / params.sectionMs);
      else if (progress > 0) {
        progress = Math.max(0, progress - dt * SLIDE_PER_MS);
        if (progress === 0) hero.set('idle');
      }
      hero.place(X, y());
      const total = ((section + progress) / (stops.length - 1)) * 100;
      fill.style.transform = `scaleX(${total / 100})`;
      meter.setAttribute('aria-valuenow', String(Math.round(total / 10) * 10));
      if (progress >= 1) reach();
    }
    raf = requestAnimationFrame(tick);
  };

  const finish = () => {
    cancelAnimationFrame(raf);
    hint.stop();
    hero.set('idle');
    onDone();
  };

  return {
    start() {
      hint.poke();
      hero.el.classList.add('is-tracking');
      hero.place(X, stops[0]);
      hero.attach(grip);
      ctx.controls.append(toggle, meter);
      const hold = { onStart: () => set(true), onEnd: () => set(false) };
      bindHold(grip, hold, s.signal);
      // держать можно в любом месте шахты
      bindHold(ctx.el, hold, s.signal);
      toggle.addEventListener('click', () => set(!holding), { signal: s.signal });
      last = performance.now();
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
