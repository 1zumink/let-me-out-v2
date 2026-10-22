// «Отпусти»: держать руки героя, потом отпустить; альтернатива — кнопка «отпустить».
import { h } from '../dom';
import { bindHold } from '../input';
import { focus, motion } from '../a11y';
import { scope, type GameFactory } from './common';

const MIN_HOLD_MS = 600;

export const createLetgo: GameFactory = (ctx, onDone) => {
  const s = scope(ctx);
  const { hero, ui } = ctx;
  let since = 0;
  let released = false;

  const hands = s.own(
    h('div.grip.grip--hands', { role: 'button', tabindex: '0', 'aria-label': ui.letgoTarget, 'aria-pressed': 'false' }),
  );
  const button = s.own(h('button.btn', { type: 'button' }, ui.letgo));
  const hint = ctx.hint();

  const fall = () => {
    const anim = motion.reduced()
      ? hero.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' })
      : hero.el.animate(
          [
            { translate: '0 0', opacity: 1 },
            { translate: '0 70vh', opacity: 0 },
          ],
          { duration: 1600, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' },
        );
    anim.finished.then(onDone, onDone);
  };

  const release = () => {
    if (released) return;
    released = true;
    hint.stop();
    hands.remove();
    button.remove();
    hero.set('letgo', fall);
  };

  return {
    start() {
      hero.set('hang');
      hero.attach(hands);
      ctx.controls.append(button);
      bindHold(
        hands,
        {
          onStart: () => {
            since = performance.now();
            hint.poke();
            hands.setAttribute('aria-pressed', 'true');
            hands.classList.add('is-held');
          },
          onEnd: () => {
            hands.setAttribute('aria-pressed', 'false');
            hands.classList.remove('is-held');
            if (performance.now() - since >= MIN_HOLD_MS) release();
          },
        },
        s.signal,
      );
      button.addEventListener('click', release, { signal: s.signal });
      focus(hands);
    },
    stop() {
      hint.stop();
      s.dispose();
    },
  };
};
