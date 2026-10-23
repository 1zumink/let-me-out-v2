// «Вдох» (этаж 2): держишь «вдох» — вдох, отпускаешь — выдох; герой поднимается на каждый вдох.
// Перестал жать на 3 с — дыхание включается само, кнопка больше не отвечает. Это и есть событие этажа.
import { h } from '../dom';
import { bindHold } from '../input';
import { focus, motion } from '../a11y';
import { scope, type GameFactory } from './common';

const IDLE_MS = 3000;
const SIX = 6;
const NONSTOP = 20;
const MIN_INHALE_MS = 250;
const AUTO_BREATH_MS = 2600;
const X = 50;
const Y0 = 82;
const RISE = 1.6; // % за вдох

export const createBreathe: GameFactory = (ctx, onDone) => {
  const s = scope(ctx);
  const { hero, ui } = ctx;
  let breaths = 0;
  let inhaling = false;
  let since = 0;
  let air = 0;
  let raf = 0;
  let last = 0;
  let idleTimer = 0;
  let speaking = false;
  let finished = false;
  let auto = false;
  const hint = ctx.hint();
  const stage = () => ctx.el.closest<HTMLElement>('.stage');

  const button = s.own(h('button.btn.btn--breathe', { type: 'button', 'aria-pressed': 'false' }, ui.breathe));
  const fill = h('span.meter__fill');
  const meter = s.own(
    h('div.meter.meter--air', { role: 'meter', 'aria-label': ui.air, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, fill),
  );

  const say = async (key: string) => {
    speaking = true;
    s.clear(idleTimer);
    await ctx.say(ctx.lines(key));
    speaking = false;
  };

  const armIdle = () => {
    s.clear(idleTimer);
    if (finished || auto) return;
    idleTimer = s.after(IDLE_MS, () => !inhaling && !speaking && stopped());
  };

  const rise = () => hero.place(X, Math.max(Y0 - breaths * RISE, 40));

  const press = () => {
    if (auto || finished) return;
    hint.poke();
    s.clear(idleTimer);
    inhaling = true;
    since = performance.now();
    button.setAttribute('aria-pressed', 'true');
    hero.set('breathe');
    stage()?.classList.add('is-inhale');
  };

  const release = async () => {
    if (!inhaling) return;
    inhaling = false;
    button.setAttribute('aria-pressed', 'false');
    stage()?.classList.remove('is-inhale');
    hero.set('idle');
    if (auto || finished) return;
    if (performance.now() - since >= MIN_INHALE_MS) {
      breaths++;
      rise();
      if (breaths === SIX) await say('six');
      if (breaths >= NONSTOP) return end('nonstop');
    }
    armIdle();
  };

  // перестал жать: экран тускнеет, плечи опускаются — и дыхание идёт само
  const stopped = async () => {
    if (finished || auto) return;
    auto = true;
    button.setAttribute('aria-disabled', 'true');
    button.classList.add('is-dead');
    stage()?.classList.add('is-dim');
    hero.set('idle');
    await say('stopped');
    if (s.signal.aborted) return;
    stage()?.classList.remove('is-dim');
    const breathe = () => {
      if (s.signal.aborted || finished) return;
      hero.set('breathe');
      stage()?.classList.add('is-inhale');
      s.after(AUTO_BREATH_MS / 2, () => {
        stage()?.classList.remove('is-inhale');
        hero.set('idle');
        breaths++;
        rise();
      });
      s.after(AUTO_BREATH_MS, breathe);
    };
    breathe();
    await say('auto');
    end();
  };

  const end = async (key?: string) => {
    if (finished) return;
    finished = true;
    hint.stop();
    s.clear(idleTimer);
    if (key) await say(key);
    if (!s.signal.aborted) onDone();
  };

  // шкала воздуха: растёт на вдохе, тает на выдохе; без пульсации при reduced motion
  const tick = (now: number) => {
    const dt = Math.min(now - last, 100);
    last = now;
    const target = inhaling || stage()?.classList.contains('is-inhale') ? 1 : 0;
    air += (target - air) * Math.min(1, dt / (motion.reduced() ? 1 : 500));
    fill.style.transform = `scaleX(${air})`;
    meter.setAttribute('aria-valuenow', String(Math.round(air * 10) * 10));
    raf = requestAnimationFrame(tick);
  };

  return {
    start() {
      hint.poke();
      hero.set('idle');
      hero.place(X, Y0);
      ctx.controls.append(meter, button);
      bindHold(button, { onStart: press, onEnd: release }, s.signal);
      last = performance.now();
      raf = requestAnimationFrame(tick);
      armIdle();
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
