// «Взмах» (этаж 5): попеременно левой и правой зоной (← / →, A / D, кнопки). В горле — «сложить / снять».
import { h } from '../dom';
import { focus } from '../a11y';
import { scope, type GameFactory } from './common';

const X = 50;
const Y_START = 80;
const Y_THROAT = 40;
const STEP = 0.12; // взмах другой рукой
const SAME = 0.04; // тем же крылом подряд — подъём слабее

export const createFlap: GameFactory = (ctx, onDone) => {
  const s = scope(ctx);
  const { hero, ui } = ctx;
  let alt = 0;
  let last: 'left' | 'right' | null = null;
  let throat = false;
  let finished = false;
  const hint = ctx.hint();

  const zoneL = s.own(h('div.flap-zone.flap-zone--left', { 'aria-hidden': 'true' }));
  const zoneR = s.own(h('div.flap-zone.flap-zone--right', { 'aria-hidden': 'true' }));
  const btnL = s.own(h('button.btn', { type: 'button' }, `← ${ui.flapLeft}`));
  const btnR = s.own(h('button.btn', { type: 'button' }, `${ui.flapRight} →`));
  const fold = s.own(h('button.btn', { type: 'button' }, ui.fold));
  const takeOff = s.own(h('button.btn', { type: 'button' }, ui.takeOff));

  const flap = (side: 'left' | 'right') => {
    if (throat || finished) return;
    hint.poke();
    alt = Math.min(1, alt + (side === last ? SAME : STEP));
    last = side;
    hero.flip(side === 'left');
    const y = Y_START - alt * (Y_START - Y_THROAT);
    hero.place(X + (side === 'left' ? -2 : 2), y);
    ctx.light(X, y - 16);
    if (alt >= 1) reachThroat();
  };

  const reachThroat = () => {
    throat = true;
    zoneL.remove();
    zoneR.remove();
    btnL.remove();
    btnR.remove();
    ctx.say(ctx.lines('throat')).then(() => {
      if (s.signal.aborted) return;
      ctx.controls.append(fold, takeOff);
      focus(fold);
      hint.poke();
    });
  };

  const pass = () => {
    if (finished) return;
    finished = true;
    hint.stop();
    fold.remove();
    takeOff.remove();
    // крылья больше не помещаются — герой протискивается в щель
    hero.set('climb');
    hero.place(X, Y_THROAT - 10);
    ctx.after(1100, onDone);
  };

  return {
    start() {
      hint.poke();
      hero.set('fly');
      ctx.el.append(zoneL, zoneR);
      ctx.controls.append(btnL, btnR);
      zoneL.addEventListener('pointerdown', () => flap('left'), { signal: s.signal });
      zoneR.addEventListener('pointerdown', () => flap('right'), { signal: s.signal });
      btnL.addEventListener('click', () => flap('left'), { signal: s.signal });
      btnR.addEventListener('click', () => flap('right'), { signal: s.signal });
      fold.addEventListener('click', pass, { signal: s.signal });
      takeOff.addEventListener('click', pass, { signal: s.signal });
      ctx.on('left', () => flap('left'));
      ctx.on('right', () => flap('right'));
      focus(btnL);
    },
    stop() {
      hint.stop();
      s.dispose();
    },
  };
};
