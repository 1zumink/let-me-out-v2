// «Взмах» (этаж 5): высокий зал на три экрана, камера летит за героем. Физика — в flapPhysics:
// поочерёдно в ритме (~3 раза в секунду) — ровно вверх, чаще — крылья путаются и слабеют,
// одно крыло подряд — несёт вбок, без взмахов — долго парит вниз и садится на выступ.
// Горло наверху открывается, когда налетался (OPEN_MS в воздухе): «сложить крылья» или «снять крылья».
import '../styles/flap.css';
import { h } from '../dom';
import { focus, motion } from '../a11y';
import { memory } from '../memory';
import { scope, type GameFactory } from './common';
import { atThroat, createFlight, flap as beat, recovery, step, type Side } from './flapPhysics';

export const FLAP = {
  hall: 3, // зал на три экрана
  y0: 82, // пол зала — на нижнем экране (в координатах слота, камера внизу)
  yTop: 36, // под горлом — на верхнем экране (камера наверху)
};
/** Сколько надо пролетать, пока горло не откроется: сначала просто летать. */
const OPEN_MS = 20000;
const RISE = (FLAP.hall - 1) * 100; // на столько зал выше экрана
/** y в единицах зала (0 — верх зала, hall×100 — низ) для высоты полёта alt. */
export const hallY = (alt: number) => RISE + FLAP.y0 - alt * (RISE + FLAP.y0 - FLAP.yTop);
/** Куда смотрит камера, чтобы герой держался около середины экрана: 0 — нижний экран, 1 — верхний. */
const camFor = (yh: number) => Math.min(1, Math.max(0, (RISE + FLAP.y0 - 27 - yh) / RISE));

const LIFTOFF = 0.04; // выше этого — «оторвался»
const STROKE_MS = 350; // как быстро затихает анимация крыльев после взмаха

export const createFlap: GameFactory = (ctx, onDone) => {
  const s = scope(ctx);
  const { hero, ui } = ctx;
  const f = createFlight(50, 0, false);
  let cam = 0;
  let speaking = false;
  let throat = false;
  let finished = false;
  let flewOnce = false;
  let landedOnce = false;
  let stroke = 0; // сила последнего взмаха, затихает
  let raf = 0;
  let lastFrame = 0;
  const hint = ctx.hint();

  const zoneL = s.own(h('div.flap-zone.flap-zone--left', { 'aria-hidden': 'true' }));
  const zoneR = s.own(h('div.flap-zone.flap-zone--right', { 'aria-hidden': 'true' }));
  const btnL = s.own(h('button.btn', { type: 'button' }, `← ${ui.flapLeft}`));
  const btnR = s.own(h('button.btn', { type: 'button' }, `${ui.flapRight} →`));
  // ритм: крылышко заполняется, пока восстанавливается
  const wingL = h('span.flap-rhythm__wing.flap-rhythm__wing--left');
  const wingR = h('span.flap-rhythm__wing.flap-rhythm__wing--right');
  const rhythm = s.own(h('div.flap-rhythm', { 'aria-hidden': 'true' }, wingL, wingR));
  const fold = s.own(h('button.btn', { type: 'button' }, ui.fold));
  const takeOff = s.own(h('button.btn', { type: 'button' }, ui.takeOff));

  // камера летит за героем; y героя — на экране, то есть в слоте: зал сдвинут на (1 − cam) × RISE
  const y = () => hallY(f.alt) - RISE * (1 - cam);
  const follow = (dt: number, snap = false) => {
    const target = camFor(hallY(f.alt));
    cam = snap || motion.reduced() ? target : cam + (target - cam) * Math.min(1, dt / 400);
    ctx.el.style.setProperty('--cam', cam.toFixed(4));
  };
  const render = () => {
    hero.place(f.x, y());
    ctx.light(f.x, y() - 16, undefined, true);
    hero.el.style.rotate = f.tilt ? `${f.tilt.toFixed(1)}deg` : '';
    if (Math.abs(f.vx) > 2) hero.flip(f.vx < 0);
    wingL.style.setProperty('--fill', recovery(f, 'left').toFixed(2));
    wingR.style.setProperty('--fill', recovery(f, 'right').toFixed(2));
  };
  // крылья машут тем быстрее, чем сильнее был взмах; без взмахов — медленно парят
  // (лента перезапускается при каждой смене состояния, поэтому проверяем каждый кадр)
  const animate = (rate: number) => {
    for (const a of hero.el.querySelector('.hero__sprite')?.getAnimations() ?? [])
      if (Math.abs(a.playbackRate - rate) > 0.05) a.playbackRate = rate;
  };
  const say = async (key: string) => {
    speaking = true;
    await ctx.say(ctx.lines(key));
    speaking = false;
  };

  const flap = (side: Side) => {
    if (throat || finished || speaking || motion.paused()) return;
    hint.poke();
    stroke = Math.max(stroke, beat(f, side, { wobble: !motion.reduced() }));
    if (f.perch === null && hero.state !== 'fly') hero.set('fly');
  };

  const tick = (now: number) => {
    const dt = Math.min(now - lastFrame, 100);
    lastFrame = now;
    raf = requestAnimationFrame(tick);
    // пока звучат реплики (или пауза), полёт стоит
    if (throat || finished || speaking || motion.paused()) return;
    const wasPerched = f.perch !== null;
    step(f, dt);
    follow(dt);
    // налетался — горло открывается: сверху свет
    if (!f.open && f.airMs > OPEN_MS) {
      f.open = true;
      ctx.el.classList.add('is-throat-open');
    }
    stroke *= Math.exp(-dt / STROKE_MS);
    if (hero.state === 'fly') animate(0.5 + 1.5 * stroke);
    render();
    if (!flewOnce && f.alt > LIFTOFF) {
      flewOnce = true;
      void say('firstFlight');
    } else if (!wasPerched && f.perch !== null) void land();
    if (atThroat(f)) void reachThroat();
  };

  const land = async () => {
    stroke = 0;
    hero.set('idle');
    if (!landedOnce && flewOnce) {
      landedOnce = true;
      await say('firstLedge');
    }
  };

  const reachThroat = async () => {
    throat = true;
    zoneL.remove();
    zoneR.remove();
    btnL.remove();
    btnR.remove();
    rhythm.remove();
    // долетает под само горло — тем же полётом, а не скольжением; камера — на верхнем экране
    hero.el.style.rotate = '';
    follow(0, true);
    hero.place(f.x, y());
    ctx.light(50, FLAP.yTop - 16);
    // повисает руками на кромке горла и покачивается, пока решает, что делать с крыльями
    await hero.go(50, hero.toFeet(FLAP.yTop - 5, 'hands'), { state: 'fly', ms: 700, stride: 4, signal: s.signal });
    if (s.signal.aborted) return;
    hero.set('hang');
    hero.el.classList.add('is-sway');
    if (!landedOnce) {
      landedOnce = true;
      await say('firstLedge');
      if (s.signal.aborted) return;
    }
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
    // крылья больше не мешают — герой протискивается в горло, упираясь в его стенки
    hero.el.classList.remove('is-sway');
    await hero.go(50, FLAP.yTop - 12, { state: 'chimney', ms: 1100, stride: 5, signal: s.signal });
    if (!s.signal.aborted) onDone();
  };

  return {
    start() {
      hint.poke();
      hero.set('idle');
      hero.el.classList.add('is-tracking');
      render();
      ctx.el.append(zoneL, zoneR);
      ctx.controls.append(btnL, rhythm, btnR);
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
      animate(1);
      hero.el.classList.remove('is-tracking', 'is-sway');
      hero.el.style.rotate = '';
      s.dispose();
    },
  };
};
