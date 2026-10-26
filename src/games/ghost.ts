// «Без тела» (этаж 6): читатель ведёт призрака — drag, тап в точку или стрелки. Сквозь стены можно,
// взять ничего нельзя. После трёх любых попыток или по «вернуться в тело» — обратно.
import { h } from '../dom';
import { focus } from '../a11y';
import { heroSpec, type Line } from '../data';
import { memory } from '../memory';
import { Hero } from '../hero/hero';
import { scope, type GameFactory } from './common';

const STEP = 5;
const WALL = 12; // линия стен, %
const HIGH = 22;
const NEAR = 9;
const TRIES = 3;
export const GHOST_PROPS = {
  // верёвка спрятана в нише правой стены: телу её не видно, призрак находит её, пройдя сквозь стену
  rope: [93, 44] as [number, number],
  jar: [40, 78] as [number, number], // где стоит банка со светом (если её забрали из сцены S3)
};
const MERGE_MS = 1400;
const FADE_MS = 500;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const createGhost: GameFactory = (ctx, onDone) => {
  const s = scope(ctx);
  const { hero, ui } = ctx;
  const events = ctx.get<Record<string, Line[]>>('events') ?? {};
  const hasJar = memory.get().jar;
  const tried = new Set<string>();
  let ghost: Hero | null = null;
  let pos: [number, number] = [0, 0];
  let body: [number, number] = [0, 0];
  let leftBody = false;
  let finished = false;
  let speaking = false;
  const hint = ctx.hint();

  const back = s.own(h('button.btn', { type: 'button' }, ui.ghostBack));
  const call = s.own(h('button.btn', { type: 'button' }, ui.ghostCall));

  const near = (p: [number, number]) => Math.hypot(pos[0] - p[0], pos[1] - p[1]) < NEAR;

  const attempt = async (key: string) => {
    // пока призрак договаривает, новое касание не засчитывается — его можно повторить
    if (finished || tried.has(key) || speaking) return;
    tried.add(key);
    if (events[key]) {
      speaking = true;
      await ctx.say(events[key]);
      speaking = false;
    }
    // «первое движение» — не попытка; попытки — стена, верёвка, тело, банка, позвать, высота
    const attempts = [...tried].filter((k) => k !== 'move').length;
    if (attempts >= TRIES) leave();
  };

  const move = (x: number, y: number, mode: 'drag' | 'float' | 'step') => {
    if (!ghost || finished) return;
    hint.poke();
    // сквозь стены можно — почти до края экрана
    const nx = clamp(x, 4, 96);
    const ny = clamp(y, 12, 90);
    ghost.el.classList.toggle('is-dragging', mode === 'drag');
    ghost.el.classList.toggle('is-floating', mode === 'float');
    ghost.flip(nx < pos[0]);
    pos = [nx, ny];
    ghost.place(nx, ny);
    // чем выше, тем бледнее линия
    ghost.el.style.setProperty('--fade', String(clamp((ny - 10) / 60, 0.25, 1)));
    attempt('move');
    if (nx < WALL || nx > 100 - WALL) attempt('wall');
    // правая стена: ниша с верёвкой открывается, когда в неё входит призрак
    if (nx > 100 - WALL) ctx.el.querySelector('.cavity')?.classList.add('is-open');
    if (near(GHOST_PROPS.rope) && ctx.el.querySelector('.cavity.is-open')) attempt('ledge');
    if (leftBody && near(body)) attempt('body');
    if (hasJar && near(GHOST_PROPS.jar)) attempt('jar');
    if (ny < HIGH) attempt('high');
    if (!near(body)) leftBody = true;
  };

  const toPercent = (e: PointerEvent): [number, number] => {
    const r = ctx.el.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100 + 8];
  };

  const leave = async () => {
    if (finished) return;
    finished = true;
    hint.stop();
    back.remove();
    call.remove();
    while (speaking) await ctx.wait(200);
    await ctx.say(ctx.lines('end'));
    if (s.signal.aborted) return;
    // призрак возвращается в тело: подплывает, гаснет, тело коротко вспыхивает
    if (ghost) {
      const g = ghost;
      g.el.classList.remove('is-dragging');
      g.el.classList.add('is-floating');
      g.place(...body);
      await ctx.wait(MERGE_MS);
      await g.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, fill: 'forwards' }).finished.catch(() => {});
      hero.el.classList.remove('is-merge');
      void hero.el.offsetWidth;
      hero.el.classList.add('is-merge');
      g.destroy();
      if (ghost === g) ghost = null;
      ctx.speaker('ghost', null);
    }
    // тихое последействие: один экран без событий
    await ctx.wait(1800);
    await ctx.say(ctx.lines('after'));
    if (!s.signal.aborted) onDone();
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
      ctx.speaker('ghost', g);
      hero.set('idle');
      ctx.after(60, () => ghost && (ghost.el.classList.add('is-floating'), ghost.place(...pos)));

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
      // тап в точку — призрак плывёт туда
      ctx.el.addEventListener('pointerdown', (e) => move(...toPercent(e), 'float'), { signal: s.signal });
      ctx.on('left', () => move(pos[0] - STEP, pos[1], 'step'));
      ctx.on('right', () => move(pos[0] + STEP, pos[1], 'step'));
      ctx.on('up', () => move(pos[0], pos[1] - STEP, 'step'));
      ctx.on('down', () => move(pos[0], pos[1] + STEP, 'step'));
      ctx.controls.append(call, back);
      // позвать: реплика появляется и сразу исчезает, не оставляя следа
      call.addEventListener('click', () => (hint.poke(), attempt('call')), { signal: s.signal });
      back.addEventListener('click', leave, { signal: s.signal });
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
