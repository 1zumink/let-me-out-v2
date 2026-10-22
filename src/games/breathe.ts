// «Вдох»: нажать на грудь или пробел; если ничего не делать, через ~6 с дыхание включается само.
import { h } from '../dom';
import { bindPress } from '../input';
import { focus } from '../a11y';
import { scope, type GameFactory } from './common';

const NEED = 3;
const AUTO_MS = 6000;
const BREATH_MS = 1400;
const AUTO_GAP_MS = 900;

export const createBreathe: GameFactory = (ctx, onDone) => {
  const s = scope(ctx);
  const { hero, ui } = ctx;
  let count = 0;
  let busy = false;
  let auto = false;
  let autoTimer = 0;

  const chest = s.own(h('div.grip.grip--chest', { role: 'button', tabindex: '0', 'aria-label': ui.breatheTarget }));
  const dots = Array.from({ length: NEED }, () => h('span.breaths__dot'));
  const counter = s.own(h('div.breaths', { 'aria-hidden': 'true' }, ...dots));
  const hint = ctx.hint();

  const arm = () => {
    s.clear(autoTimer);
    autoTimer = s.after(auto ? AUTO_GAP_MS : AUTO_MS, () => {
      auto = true;
      breath();
    });
  };

  const breath = () => {
    if (busy || count >= NEED) return;
    busy = true;
    s.clear(autoTimer);
    hero.set('breathe');
    chest.classList.add('is-in');
    ctx.el.closest('.stage')?.classList.add('is-inhale');
    s.after(BREATH_MS, () => {
      busy = false;
      dots[count].classList.add('is-on');
      count++;
      chest.classList.remove('is-in');
      ctx.el.closest('.stage')?.classList.remove('is-inhale');
      hero.set('idle');
      if (count >= NEED) {
        hint.stop();
        onDone();
      } else arm();
    });
  };

  return {
    start() {
      hero.set('idle');
      hero.attach(chest);
      ctx.controls.append(counter);
      bindPress(
        chest,
        () => {
          hint.poke();
          breath();
        },
        s.signal,
      );
      arm();
      focus(chest);
    },
    stop() {
      hint.stop();
      ctx.el.closest('.stage')?.classList.remove('is-inhale');
      s.dispose();
    },
  };
};
