// «Вдох» (этаж 2): пробел, тап по сцене или «вдох» — вдох; на каждом вдохе герой подтягивается
// по дымоходу, упираясь в обе стены. Не вдыхаешь 3 с — темнеет; 6 с — срывается к началу коридора.
// Логика таймеров — в breathePhysics.
import { h } from '../dom';
import { focus, motion } from '../a11y';
import { scope, type GameFactory } from './common';
import { atTop, createClimb, dim, inhale, inhaling, step } from './breathePhysics';

const SIX = 6;
const X = 50;
const Y0 = 82;
const Y1 = 46;

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export const createBreathe: GameFactory = (ctx, onDone) => {
  const s = scope(ctx);
  const { hero, ui } = ctx;
  const c = createClimb();
  let raf = 0;
  let last = 0;
  let air = 0;
  let lightY = Y0;
  let hold = false; // герой говорит — часы бездействия стоят
  let saidSix = false;
  let wasDim = false;
  let finished = false;
  const hint = ctx.hint();
  const stage = () => ctx.el.closest<HTMLElement>('.stage');

  const button = s.own(h('button.btn.btn--breathe', { type: 'button' }, ui.breathe));
  const fill = h('span.meter__fill');
  const meter = s.own(
    h('div.meter.meter--air', { role: 'meter', 'aria-label': ui.air, 'aria-valuemin': '0', 'aria-valuenow': '0', 'aria-valuemax': '100' }, fill),
  );

  const say = async (key: string, pause: boolean) => {
    hold = pause;
    await ctx.say(ctx.lines(key));
    hold = false;
  };

  const breath = () => {
    if (finished) return;
    hint.poke();
    if (!inhale(c)) return;
    if (c.breaths === SIX && !saidSix) {
      saidSix = true;
      say('six', true);
    }
  };

  const pose = (state: Parameters<typeof hero.set>[0]) => hero.state !== state && hero.set(state);

  const tick = (now: number) => {
    const dt = Math.min(now - last, 100);
    last = now;
    step(c, dt, hold);
    // reduced motion: подъём ступенькой на вдох, срыв — тот же путь вниз
    const p = motion.reduced() && !c.slipping ? c.target : c.p;
    const y = Y0 + (Y1 - Y0) * p;
    hero.place(X, y);
    // свет идёт за героем; радиус дымохода — как у этажа (floor2), тускнеет и вдыхает — CSS
    if (Math.abs(y - lightY) > 2) ctx.light(X, (lightY = y) - 16, 24);

    if (c.slipping) pose('slip');
    else if (c.p < c.target) pose('climb');
    else if (dim(c)) pose('idle');
    else pose('breathe');

    const d = dim(c);
    stage()?.classList.toggle('is-dim', d);
    if (d && !wasDim && !c.slipping) say('stopped', false);
    wasDim = d;

    const on = inhaling(c);
    stage()?.classList.toggle('is-inhale', on);
    air += ((on ? 1 : 0) - air) * Math.min(1, dt / (motion.reduced() ? 1 : 500));
    fill.style.transform = `scaleX(${air})`;
    meter.setAttribute('aria-valuenow', String(Math.round(air * 10) * 10));

    if (atTop(c)) return end();
    raf = requestAnimationFrame(tick);
  };

  const end = async () => {
    finished = true;
    hint.stop();
    stage()?.classList.remove('is-inhale', 'is-dim');
    pose('idle');
    await say('nonstop', true);
    if (!s.signal.aborted) onDone();
  };

  return {
    start() {
      hint.poke();
      hero.place(X, Y0);
      pose('breathe');
      ctx.controls.append(meter, button);
      const tap = (e: PointerEvent) => {
        if (e.button !== 0) return;
        // по сцене — кроме её кнопок и облачков (облачко тапом пролистывается)
        if (e.currentTarget !== button && e.target instanceof Element && e.target.closest('button, a, .bubble')) return;
        e.preventDefault();
        breath();
      };
      button.addEventListener('pointerdown', tap, { signal: s.signal });
      (stage() ?? ctx.el).addEventListener('pointerdown', tap, { signal: s.signal });
      // пробел — откуда угодно; Enter — на «вдохе». Клик кнопки не слушаем: не будет двойного вдоха
      window.addEventListener(
        'keydown',
        (e) => {
          const space = e.code === 'Space' || e.key === ' ';
          const own = e.target === button || !(e.target instanceof HTMLElement && e.target.closest('button, a, [role="button"]'));
          if (!own || typing(e.target) || !(space || (e.key === 'Enter' && e.target === button))) return;
          e.preventDefault();
          if (!e.repeat) breath();
        },
        { signal: s.signal },
      );
      window.addEventListener('keyup', (e) => e.target === button && e.key === ' ' && e.preventDefault(), { signal: s.signal });
      last = performance.now();
      raf = requestAnimationFrame(tick);
      focus(button);
    },
    stop() {
      cancelAnimationFrame(raf);
      hint.stop();
      stage()?.classList.remove('is-inhale', 'is-dim');
      s.dispose();
    },
  };
};
