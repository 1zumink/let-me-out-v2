// «Без тела» (этаж 6): призрак водится drag-ом, стрелками или тапом в точку; кнопка «вернуться в тело».
import { h } from '../dom';
import { focus } from '../a11y';
import { heroSpec } from '../data';
import { Hero } from '../hero/hero';
import { scope, type GameFactory } from './common';

const STEP = 4;
const EXIT: [number, number] = [72, 24];
const REACH = 8;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const createGhost: GameFactory = (ctx, onDone) => {
  const s = scope(ctx);
  const { hero, ui } = ctx;
  let ghost: Hero | null = null;
  let pos: [number, number] = [0, 0];
  let body: [number, number] = [0, 0];
  let finished = false;
  const hint = ctx.hint();

  const crack = s.own(h('div.ghost-exit', { 'aria-hidden': 'true' }));
  crack.style.left = `${EXIT[0]}%`;
  crack.style.top = `${EXIT[1]}%`;
  ctx.el.append(crack);
  const back = s.own(h('button.btn', { type: 'button' }, ui.ghostBack));

  const move = (x: number, y: number, mode: 'drag' | 'float' | 'step') => {
    if (!ghost || finished) return;
    hint.poke();
    const nx = clamp(x, 14, 86);
    const ny = clamp(y, 16, 88);
    ghost.el.classList.toggle('is-dragging', mode === 'drag');
    ghost.el.classList.toggle('is-floating', mode === 'float');
    ghost.flip(nx < pos[0]);
    pos = [nx, ny];
    ghost.place(nx, ny);
    if (Math.hypot(nx - EXIT[0], ny - EXIT[1]) < REACH) leave('out');
  };

  const toPercent = (e: PointerEvent): [number, number] => {
    const r = ctx.el.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100 + 8];
  };

  const leave = (how: 'out' | 'back') => {
    if (finished) return;
    finished = true;
    hint.stop();
    back.remove();
    if (how === 'back' && ghost) {
      ghost.el.classList.add('is-floating');
      ghost.place(...body);
    }
    ctx.after(how === 'back' ? 1300 : 600, () => {
      ghost?.destroy();
      ghost = null;
      hero.set('idle');
      ctx.say(ctx.lines(how)).then(() => !s.signal.aborted && onDone());
    });
  };

  return {
    start() {
      hint.poke();
      body = hero.position;
      pos = [body[0], body[1] - 6];
      ghost = new Hero(heroSpec, import.meta.env.BASE_URL);
      const g = ghost.el;
      g.classList.add('is-ghost-ctl');
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-label', ui.ghostTarget);
      hero.el.after(g);
      ghost.place(...body);
      ghost.set('ghost');
      hero.set('idle');
      ctx.after(60, () => move(pos[0], pos[1], 'float'));
      ctx.light(EXIT[0], EXIT[1] + 10, 40);

      let dragging = false;
      g.addEventListener(
        'pointerdown',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          dragging = true;
          g.setPointerCapture(e.pointerId);
          g.focus({ preventScroll: true });
        },
        { signal: s.signal },
      );
      g.addEventListener('pointermove', (e) => dragging && move(...toPercent(e), 'drag'), { signal: s.signal });
      const drop = () => {
        dragging = false;
        g.classList.remove('is-dragging');
      };
      g.addEventListener('pointerup', drop, { signal: s.signal });
      g.addEventListener('pointercancel', drop, { signal: s.signal });
      // тап в пустое место — призрак плывёт туда
      ctx.el.addEventListener('pointerdown', (e) => move(...toPercent(e), 'float'), { signal: s.signal });
      ctx.on('left', () => move(pos[0] - STEP, pos[1], 'step'));
      ctx.on('right', () => move(pos[0] + STEP, pos[1], 'step'));
      ctx.on('up', () => move(pos[0], pos[1] - STEP, 'step'));
      ctx.on('down', () => move(pos[0], pos[1] + STEP, 'step'));
      ctx.controls.append(back);
      back.addEventListener('click', () => leave('back'), { signal: s.signal });
      focus(g);
    },
    stop() {
      hint.stop();
      ghost?.destroy();
      ghost = null;
      s.dispose();
    },
  };
};
