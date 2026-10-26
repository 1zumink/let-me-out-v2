// Двенадцать мест снизу вверх: девять этажей и три прохода (docs/text-v2.md, «Карта этажей»).
import { h } from '../dom';
import { focus } from '../a11y';
import type { Line } from '../data';
import { memory } from '../memory';
import { games } from '../games';
import { buildRoom } from '../games/remove';
import { GHOST_PROPS } from '../games/ghost';
import { FLAP } from '../games/flap';
import { Creature } from '../ui/Creature';
import { gameFloor } from './gameFloor';
import { passage as passageFloor } from './passage';
import type { Floor, FloorCtx } from './types';

const img = (src: string, cls = 'cutout') => h(`img.${cls}`, { src: import.meta.env.BASE_URL + src, alt: '', 'aria-hidden': 'true', loading: 'lazy' });

// 0. Дно: темнота, человечек на камне, сверху иногда падает полоска света
export const floor0 = () =>
  gameFloor({
    heroAt: [50, 84],
    heroState: 'sit',
    light: [50, 70, 26],
    world: { ledges: [{ x0: 8, x1: 92, y: 84, depth: 20 }, { x0: 44, x1: 56, y: 84.5, depth: 3 }] },
    decorate: (ctx) => {
      ctx.el.append(h('div.light-strip', { 'aria-hidden': 'true' }));
      // «а один раз упал носок» — вырезка, как и вещи выше
      const sock = h('img.cutout.floor-sock', { src: import.meta.env.BASE_URL + 'assets/collage/sock.svg', alt: 'носок, упавший сверху', loading: 'lazy' });
      ctx.el.append(sock);
    },
  });

// ↑ Случайный проход (route.ts): одна вещь в нише. Внизу шахта из бетонных колец, выше — земля с корнями
export const passage = () =>
  passageFloor({
    world: { wall: 16 },
    decorate: (ctx) => {
      if ((ctx.data.params as { texture?: string } | undefined)?.texture === 'rings') ctx.el.append(h('div.rings', { 'aria-hidden': 'true' }));
    },
  });

// 1. Руки и 7. Свет — «Держи»: выступы-остановки на стене
const holdFloor = (smooth: boolean) => () =>
  gameFloor({
    heroAt: [50, 84],
    restState: 'idle',
    world: { wall: 14, ledges: [{ x0: 30, x1: 70, y: 84, depth: 12 }] },
    decorate: (ctx) => {
      const stops = (ctx.data.params as { stops: number[] }).stops;
      if (!smooth) {
        // выступы на остановках (руки на кромке), последний — широкий, на него садятся;
        // на этаже 7 стены гладкие
        const svg = ctx.el.querySelector('.silhouette');
        stops.forEach((y, i) => {
          const [a, b] = i === stops.length - 1 ? [32, 68] : [42, 58];
          svg?.insertAdjacentHTML('beforeend', `<polygon points="${a},${y} ${b},${y + 0.4} ${b - 1},${y + 3} ${a + 1},${y + 2.6}"/>`);
        });
      } else ctx.el.append(h('div.light-window', { 'aria-hidden': 'true' }));
    },
  });
export const floor1 = holdFloor(false);
export const floor7 = holdFloor(true);

// 2. Дыхание: узкий каменный дымоход, края экрана темнее
export const floor2 = (): Floor => {
  const base = gameFloor({ heroAt: [50, 82], world: { wall: 32, ledges: [{ x0: 30, x1: 70, y: 82, depth: 18 }] }, light: [50, 66, 24] });
  return { ...base, arrive: () => (base.arrive?.(), document.querySelector('.stage')?.classList.add('is-narrow')), unmount: () => (document.querySelector('.stage')?.classList.remove('is-narrow'), base.unmount()) };
};


// 3. Деревянная комната. Второй круг — такой, какой её оставили, без игры
export const floor3 = () => {
  const revisit = (ctx: FloorCtx) => ctx.lap === 2 && memory.get().roomRemoved !== null;
  const narrow = window.matchMedia('(max-width: 560px)').matches;
  return gameFloor({
    // на узком экране герой стоит у самого входа, чтобы не закрывать вещи
    heroAt: [narrow ? 10 : 24, 84],
    light: [48, 60, 60],
    world: { wall: 6, ledges: [{ x0: 4, x1: 96, y: 84, depth: 16 }] },
    hasGame: (ctx) => !revisit(ctx),
    decorate: (ctx) => {
      if (revisit(ctx)) ctx.el.append(buildRoom(ctx, memory.get().roomRemoved ?? [], false).room);
    },
    enterLines: (ctx) => {
      if (!revisit(ctx)) return ctx.lines('enter');
      const all = (ctx.data.collage ?? []).every((it) => memory.get().roomRemoved?.includes(it.id));
      return ctx.lines(all ? 'emptyRoom' : 'fullRoom');
    },
  });
};

// 4. Ниша Кости: диалог, «посидеть с Костей» — ещё две реплики
export const floor4 = () =>
  gameFloor({
    heroAt: [38, 80],
    light: [52, 66, 34],
    world: { ledges: [{ x0: 20, x1: 80, y: 80, depth: 12 }] },
    decorate: (ctx) => {
      const niche = h('div.niche', { 'aria-hidden': 'true' });
      const kostya = Creature('kostya', { x: 66, y: 73, size: 120, rng: ctx.rng, signal: ctx.signal, label: 'Костя' });
      ctx.el.append(niche, kostya);
      ctx.speaker('kostya', kostya as unknown as HTMLElement);
    },
    script: (ctx) => ctx.done(),
    rest: (ctx) => {
      if (ctx.lap === 2) return;
      const sit = h('button.btn', { type: 'button' }, ctx.ui.sitWithKostya);
      sit.addEventListener('click', async () => {
        sit.remove();
        await ctx.say(ctx.lines('sit'));
      });
      ctx.controls.append(sit);
    },
  });

// 5. Крылья: высокий зал, выступ посередине, наверху узкое горло
export const floor5 = () => {
  const yOf = (alt: number) => FLAP.y0 - alt * (FLAP.y0 - FLAP.yTop);
  return gameFloor({
    heroAt: [50, FLAP.y0],
    restAt: [50, FLAP.yTop - 12],
    restState: 'idle',
    light: [50, 50, 46],
    world: {
      wall: 10,
      ledges: [
        { x0: 30, x1: 70, y: FLAP.y0, depth: 10 },
        { x0: 40, x1: 60, y: yOf(FLAP.ledge), depth: 3 },
        { x0: 40, x1: 60, y: FLAP.yTop - 12, depth: 3 },
      ],
      throat: { y: FLAP.yTop - 6, gap: 12 },
    },
    decorate: (ctx) => {
      // на втором круге снятые крылья так и висят на выступе
      if (ctx.lap === 2 && memory.get().wings === 'removed') {
        const w = img('assets/collage/wings.svg', 'cutout.hanging-wings');
        ctx.el.append(w);
      }
    },
    enterLines: (ctx) => {
      const w = ctx.lap === 2 ? memory.get().wings : null;
      if (w === 'removed') return ctx.lines('enterRemoved');
      if (w === 'folded') return ctx.lines('enterFolded');
      return ctx.lines('enter');
    },
  });
};

// ↑ Проход: тихий уступ — остаться или дальше; оба пути сходятся
export const passageLedge = (): Floor => {
  const base = gameFloor({ heroAt: [50, 70], light: [50, 56, 40], world: { wall: 12, ledges: [{ x0: 22, x1: 78, y: 70, depth: 8 }] } });
  let ctx: FloorCtx;
  return {
    ...base,
    mount(c) {
      ctx = c;
      base.mount(c);
    },
    hasGame: () => false,
    start() {
      const choose = async (lines: Line[], later: boolean) => {
        stay.remove();
        further.remove();
        await ctx.say(lines);
        // остаться: ничего не происходит, через 20 секунд — ещё одна реплика
        if (later) {
          await ctx.wait(20000);
          await ctx.say(ctx.lines('stayLater'));
        }
        await ctx.say(ctx.lines('converge'));
        if (!ctx.signal.aborted) ctx.done();
      };
      const stay = h('button.btn', { type: 'button' }, ctx.ui.stay);
      const further = h('button.btn', { type: 'button' }, ctx.ui.further);
      stay.addEventListener('click', () => choose(ctx.lines('stay'), true));
      further.addEventListener('click', () => choose(ctx.lines('further'), false));
      ctx.controls.append(stay, further);
      focus(stay);
    },
  };
};

// 6. Призрак. Верёвка в нише правой стены: найдёт призрак — потом за неё возьмётся тело.
// Второй круг — игра только по «всё равно попробовать».
const takeRope = (ctx: FloorCtx) => {
  if (!ctx.el.querySelector('.cavity.is-open')) return;
  // последствие прохода сквозь стену: тело идёт к найденной верёвке и берётся за неё — подъём начнётся отсюда
  const [rx, ry] = GHOST_PROPS.rope;
  ctx.hero.flip(false);
  ctx.hero.set('climb');
  ctx.hero.place(rx - 4, 80);
  ctx.light(rx - 4, ry + 20, 30);
  ctx.after(950, () => ctx.hero.set('held'));
};

export const floor6 = () =>
  gameFloor({
    heroAt: [30, 80],
    heroState: 'sit',
    light: [42, 66, 26],
    world: { ledges: [{ x0: 12, x1: 92, y: 80, depth: 10 }] },
    hasGame: (ctx) => ctx.lap === 1,
    decorate: (ctx) => {
      const [rx, ry] = GHOST_PROPS.rope;
      const rope = h('div.rope', { 'aria-hidden': 'true' });
      rope.style.left = `${rx}%`;
      rope.style.height = `${ry + 36}%`;
      const cavity = h('div.cavity', { 'aria-hidden': 'true' }, rope);
      ctx.el.append(cavity);
      if (memory.get().jar) {
        const jar = img('assets/collage/jar.svg', 'cutout.jar-light');
        jar.style.left = `${GHOST_PROPS.jar[0]}%`;
        jar.style.top = `${GHOST_PROPS.jar[1]}%`;
        ctx.el.append(jar);
      }
    },
    rest: (ctx) => {
      takeRope(ctx);
      if (ctx.lap !== 2) return;
      const tryBtn = h('button.btn', { type: 'button' }, ctx.ui.ghostTry);
      tryBtn.addEventListener('click', () => {
        tryBtn.remove();
        const game = games.ghost!(ctx, () => {
          game.stop();
          takeRope(ctx);
        });
        game.start();
      });
      ctx.controls.append(tryBtn);
    },
  });

// 8. Край: стекло экрана, белая пустота, герой висит под указателем
export const floor8 = (): Floor => {
  const GLASS = 16;
  const base = gameFloor({ heroAt: [50, GLASS], heroAnchor: 'hands', heroState: 'hang', light: [50, 40, 70], world: { glass: GLASS, wall: 4 } });
  const white = (on: boolean) => document.querySelector('.stage')?.classList.toggle('is-white', on);
  return { ...base, arrive: () => (base.arrive?.(), white(true)), unmount: () => (white(false), base.unmount()) };
};
