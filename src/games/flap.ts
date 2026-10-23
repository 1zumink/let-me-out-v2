// «Взмах» (этаж 5): поочерёдно левое и правое крыло — подъём. Одно крыло дважды — ведёт вбок,
// слишком быстро — крылья путаются, без взмахов — плавно опускается на ближайший выступ.
// Наверху горло: «сложить крылья» или «снять крылья».
import { h } from '../dom';
import { focus, motion } from '../a11y';
import { memory } from '../memory';
import { scope, type GameFactory } from './common';

export const FLAP = {
  y0: 82, // пол зала
  ledge: 0.5, // выступ посередине (доля высоты полёта)
  yTop: 36, // под горлом
  step: 0.07,
  drift: 7, // % вбок за повтор одного крыла
  tooFastMs: 180,
  tangleMs: 600,
  glideAfterMs: 1300,
  glidePerMs: 1 / 9000,
};

export const createFlap: GameFactory = (ctx, onDone) => {
  const s = scope(ctx);
  const { hero, ui } = ctx;
  let alt = 0;
  let x = 50;
  let last: 'left' | 'right' | null = null;
  let lastAt = 0;
  let floor = 0; // ниже этого не опускается: пол или выступ
  let tangled = false;
  let speaking = false;
  let throat = false;
  let finished = false;
  let flewOnce = false;
  let landedOnce = false;
  let raf = 0;
  let lastFrame = 0;
  const hint = ctx.hint();

  const zoneL = s.own(h('div.flap-zone.flap-zone--left', { 'aria-hidden': 'true' }));
  const zoneR = s.own(h('div.flap-zone.flap-zone--right', { 'aria-hidden': 'true' }));
  const btnL = s.own(h('button.btn', { type: 'button' }, `← ${ui.flapLeft}`));
  const btnR = s.own(h('button.btn', { type: 'button' }, `${ui.flapRight} →`));
  const fold = s.own(h('button.btn', { type: 'button' }, ui.fold));
  const takeOff = s.own(h('button.btn', { type: 'button' }, ui.takeOff));

  const y = () => FLAP.y0 - alt * (FLAP.y0 - FLAP.yTop);
  const show = () => {
    hero.place(x, y());
    ctx.light(x, y() - 16);
  };
  const say = async (key: string) => {
    speaking = true;
    await ctx.say(ctx.lines(key));
    speaking = false;
  };

  const flap = async (side: 'left' | 'right') => {
    if (throat || finished || speaking) return;
    hint.poke();
    const now = performance.now();
    // слишком быстро — крылья путаются: короткий сбой без подъёма
    if (now - lastAt < FLAP.tooFastMs && !motion.reduced()) {
      lastAt = now;
      if (tangled) return;
      tangled = true;
      hero.set('slip');
      s.after(FLAP.tangleMs, () => {
        tangled = false;
        hero.set('fly');
      });
      return;
    }
    lastAt = now;
    if (tangled) return;
    hero.flip(side === 'left');
    if (side === last) {
      // два раза одно крыло — героя ведёт вбок
      x = Math.min(78, Math.max(22, x + (side === 'left' ? -FLAP.drift : FLAP.drift)));
      alt = Math.min(1, alt + FLAP.step / 3);
    } else {
      alt = Math.min(1, alt + FLAP.step);
      x += (50 - x) * 0.25;
    }
    last = side;
    show();
    if (!flewOnce && alt > 0.08) {
      flewOnce = true;
      await say('firstFlight');
    }
    if (!landedOnce && alt >= FLAP.ledge) {
      // первая остановка на выступе посреди зала
      landedOnce = true;
      floor = FLAP.ledge;
      alt = FLAP.ledge;
      x = 50;
      hero.set('idle');
      show();
      await say('firstLedge');
      if (!s.signal.aborted) hero.set('fly');
    }
    if (alt >= 1) reachThroat();
  };

  // без взмахов — плавно опускается на ближайший выступ
  const tick = (now: number) => {
    const dt = Math.min(now - lastFrame, 100);
    lastFrame = now;
    if (!throat && !finished && !speaking && alt > floor && now - lastAt > FLAP.glideAfterMs) {
      alt = Math.max(floor, alt - dt * FLAP.glidePerMs * (motion.reduced() ? 2 : 1));
      if (motion.reduced()) alt = Math.round(alt * 20) / 20;
      show();
    }
    raf = requestAnimationFrame(tick);
  };

  const reachThroat = async () => {
    throat = true;
    zoneL.remove();
    zoneR.remove();
    btnL.remove();
    btnR.remove();
    hero.set('idle');
    await say('throat');
    if (s.signal.aborted) return;
    ctx.controls.append(fold, takeOff);
    focus(fold);
    hint.poke();
  };

  const pass = async (how: 'folded' | 'removed') => {
    if (finished) return;
    finished = true;
    hint.stop();
    fold.remove();
    takeOff.remove();
    memory.set({ wings: how });
    await say(how === 'folded' ? 'fold' : 'takeOff');
    if (s.signal.aborted) return;
    // крылья больше не мешают — герой протискивается в горло
    hero.set('climb');
    hero.place(50, FLAP.yTop - 12);
    ctx.after(1100, onDone);
  };

  return {
    start() {
      hint.poke();
      hero.set('fly');
      show();
      ctx.el.append(zoneL, zoneR);
      ctx.controls.append(btnL, btnR);
      zoneL.addEventListener('pointerdown', () => flap('left'), { signal: s.signal });
      zoneR.addEventListener('pointerdown', () => flap('right'), { signal: s.signal });
      btnL.addEventListener('click', () => flap('left'), { signal: s.signal });
      btnR.addEventListener('click', () => flap('right'), { signal: s.signal });
      fold.addEventListener('click', () => pass('folded'), { signal: s.signal });
      takeOff.addEventListener('click', () => pass('removed'), { signal: s.signal });
      ctx.on('left', () => flap('left'));
      ctx.on('right', () => flap('right'));
      lastFrame = performance.now();
      raf = requestAnimationFrame(tick);
      focus(btnL);
    },
    stop() {
      cancelAnimationFrame(raf);
      hint.stop();
      s.dispose();
    },
  };
};
