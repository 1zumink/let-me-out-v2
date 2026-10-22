// «Держи»: удерживать руку указателем или пробелом; альтернатива — кнопка-переключатель.
import { h } from '../dom';
import { bindHold } from '../input';
import { focus } from '../a11y';
import { scope, type GameFactory } from './common';

const HOLD_MS = 4500;

export const createHold: GameFactory = (ctx, onDone) => {
  const s = scope(ctx);
  const { hero, ui } = ctx;
  let holding = false;
  let progress = 0;
  let finished = false;
  let raf = 0;
  let last = 0;
  let slipTimer = 0;

  const target = s.own(
    h(
      'div.grip.grip--hand',
      { role: 'button', tabindex: '0', 'aria-label': ui.holdTarget, 'aria-pressed': 'false' },
      h('span.grip__arm', { 'aria-hidden': 'true' }),
    ),
  );
  const toggle = s.own(h('button.btn', { type: 'button', 'aria-pressed': 'false' }, ui.holdToggle));
  const fill = h('span.meter__fill');
  const meter = s.own(
    h(
      'div.meter',
      { role: 'progressbar', 'aria-label': ui.holdProgress, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' },
      fill,
    ),
  );
  const hint = ctx.hint();

  const set = (value: boolean) => {
    if (finished || value === holding) return;
    holding = value;
    hint.poke();
    target.setAttribute('aria-pressed', String(value));
    toggle.setAttribute('aria-pressed', String(value));
    target.classList.toggle('is-held', value);
    s.clear(slipTimer);
    if (value) {
      hero.set('hold');
    } else {
      // отпустил — герой соскальзывает, но не падает: проигрыша нет
      hero.set('slip');
      slipTimer = s.after(700, () => !holding && hero.set('hang'));
    }
  };

  const tick = (now: number) => {
    const dt = Math.min(now - last, 100);
    last = now;
    if (holding) progress = Math.min(1, progress + dt / HOLD_MS);
    fill.style.transform = `scaleX(${progress})`;
    meter.setAttribute('aria-valuenow', String(Math.round(progress * 10) * 10));
    if (progress >= 1) return finish();
    raf = requestAnimationFrame(tick);
  };

  const finish = () => {
    finished = true;
    cancelAnimationFrame(raf);
    hint.stop();
    hero.set('hold');
    onDone();
  };

  return {
    start() {
      hero.set('hang');
      hero.attach(target);
      ctx.controls.append(toggle, meter);
      bindHold(target, { onStart: () => set(true), onEnd: () => set(false) }, s.signal);
      toggle.addEventListener('click', () => set(!holding), { signal: s.signal });
      last = performance.now();
      raf = requestAnimationFrame(tick);
      focus(target);
    },
    stop() {
      cancelAnimationFrame(raf);
      hint.stop();
      s.dispose();
    },
  };
};
