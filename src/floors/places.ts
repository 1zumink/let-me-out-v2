// Двенадцать мест снизу вверх: девять этажей и три прохода (docs/text-v2.md, «Карта этажей»).
import { h } from '../dom';
import { focus, motion } from '../a11y';
import type { Line } from '../data';
import { memory } from '../memory';
import { games } from '../games';
import { buildRoom } from '../games/remove';
import { GHOST_PROPS } from '../games/ghost';
import { FLAP, hallY } from '../games/flap';
import { LEDGES } from '../games/flapPhysics';
import { HOLD_WALL } from '../games/hold';
import { Creature } from '../ui/Creature';
import { gameFloor } from './gameFloor';
import { passage as passageFloor } from './passage';
import { textureUrl } from '../scene/textures';
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
      const sock = h('img.cutout.floor-sock', { src: import.meta.env.BASE_URL + 'assets/collage/sock.webp', alt: 'носок, упавший сверху', loading: 'lazy' });
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

// 1. Руки и 7. Свет — «Держи»: герой лезет по левой стене, выступы-остановки на ней
const stopsOf = (ctx: FloorCtx) => (ctx.data.params as { stops: number[]; end?: 'hang' });
const holdFloor = (smooth: boolean) => () =>
  gameFloor({
    heroAt: [HOLD_WALL + 10, 84],
    // этаж 7 кончается висом за край — стоять в воздухе он не должен
    restState: smooth ? undefined : 'idle',
    world: { wall: HOLD_WALL, ledges: [{ x0: HOLD_WALL, x1: 62, y: 84, depth: 12 }] },
    // последний широкий выступ — на нём сидят и с него лезут дальше; на этаже 7 подъём кончается висом
    ground: (ctx) => {
      const { stops, end } = stopsOf(ctx);
      return { side: 'left', ledges: end === 'hang' ? [] : [{ x0: HOLD_WALL - 1, x1: HOLD_WALL + 24, y: stops[stops.length - 1] }] };
    },
    decorate: (ctx) => {
      const { stops } = stopsOf(ctx);
      if (!smooth) {
        // выступы на остановках у левой стены (руки на кромке), последний — широкий, на него садятся;
        // на этаже 7 стены гладкие
        const svg = ctx.el.querySelector('.silhouette');
        stops.forEach((y, i) => {
          const [a, b] = i === stops.length - 1 ? [HOLD_WALL - 1, HOLD_WALL + 24] : [HOLD_WALL - 1, HOLD_WALL + 12];
          svg?.insertAdjacentHTML('beforeend', `<polygon points="${a},${y} ${b},${y + 0.4} ${b - 1},${y + 3} ${a + 1},${y + 2.6}"/>`);
        });
      } else ctx.el.append(h('div.light-window', { 'aria-hidden': 'true' }));
    },
  });
export const floor1 = holdFloor(false);
export const floor7 = holdFloor(true);

// 2. Дыхание: узкий каменный дымоход — стены по герою, плечи и ноги упираются в камень; края экрана темнее
export const floor2 = (): Floor => {
  const base = gameFloor({
    heroAt: [50, 82],
    light: [50, 66, 24],
    worldFor: (ctx) => {
      // стена = середина минус чуть больше половины героя: распор, а не вис в воздухе
      const wall = Math.max(20, 50 - ctx.hero.box().w * 0.3);
      return { wall, ledges: [{ x0: wall - 2, x1: 102 - wall, y: 82, depth: 18 }] };
    },
    ground: () => ({ chimney: true }),
  });
  return { ...base, arrive: () => (base.arrive?.(), document.querySelector('.stage')?.classList.add('is-narrow')), unmount: () => (document.querySelector('.stage')?.classList.remove('is-narrow'), base.unmount()) };
};

// 3. Деревянная комната — домик на уступе: снаружи фасад с дверью посередине. Герой подходит к двери, она открывается,
// фасад гаснет и проявляется комната в разрезе; герой проходит к своему месту. Второй круг — комната такая, какой её оставили, без игры
const HOUSE = import.meta.env.BASE_URL + 'assets/collage/';

/** Фасад: фото автора (house.webp, house-door-open.webp), если есть, иначе силуэт из досок с нарисованной дверью. */
function houseFront() {
  const front = h('div.house', { 'aria-hidden': 'true' });
  const planks = textureUrl('planks');
  if (planks) front.style.setProperty('--planks', `url("${planks}")`);
  const door = h('div.house__door');
  const photo = h('img.house__photo', { src: HOUSE + 'house.webp', alt: '', decoding: 'async' });
  const open = new Image();
  // своей картинки нет — остаётся нарисованный фасад
  photo.addEventListener('error', () => photo.remove());
  photo.addEventListener('load', () => {
    front.classList.add('has-photo');
    open.src = HOUSE + 'house-door-open.webp';
  });
  front.append(photo, door);
  return {
    front,
    openDoor() {
      door.classList.add('is-open');
      if (front.classList.contains('has-photo') && open.complete && open.naturalWidth) photo.src = open.src;
    },
  };
}

export const floor3 = (): Floor => {
  const revisit = (ctx: FloorCtx) => ctx.lap === 2 && memory.get().roomRemoved !== null;
  // на узком экране герой стоит у самого входа, чтобы не закрывать вещи
  const narrow = window.matchMedia('(max-width: 560px) and (orientation: portrait)').matches;
  const spot = narrow ? 10 : 24;
  let house: ReturnType<typeof houseFront> | null = null;
  let ctx: FloorCtx;
  const base = gameFloor({
    // подъём приводит к двери домика — она посередине
    heroAt: [50, 84],
    light: [48, 60, 60],
    world: { wall: 6, ledges: [{ x0: 4, x1: 96, y: 84, depth: 16 }] },
    hasGame: (ctx) => !revisit(ctx),
    decorate: (c) => {
      ctx = c;
      if (revisit(c)) c.el.append(buildRoom(c, memory.get().roomRemoved ?? [], false).room);
      house = houseFront();
      c.el.append(house.front);
      // пока не вошёл, комнаты не видно: за краями фасада только уступ
      c.el.classList.add('is-outside');
    },
    enterLines: (ctx) => {
      if (!revisit(ctx)) return ctx.lines('enter');
      const all = (ctx.data.collage ?? []).every((it) => memory.get().roomRemoved?.includes(it.id));
      return ctx.lines(all ? 'emptyRoom' : 'fullRoom');
    },
  });
  return {
    ...base,
    arrive() {
      base.arrive?.();
      const hs = house;
      if (!hs) return;
      const quick = motion.reduced();
      ctx.after(quick ? 0 : 500, () => hs.openDoor());
      ctx.after(quick ? 0 : 1300, () => {
        hs.front.classList.add('is-gone');
        ctx.el.classList.remove('is-outside');
        // вошёл — проходит к своему месту у входа
        void ctx.hero.walkTo(spot, 1200, ctx.signal);
      });
    },
  };
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

// 5. Крылья: высокий зал на три экрана, стены у краёв, выступы по залу — где отдохнуть; наверху узкое горло.
// Силуэт и выступы — в единицах зала (FLAP.hall × 100), путь подъёма — в координатах слота при камере внизу и наверху
export const floor5 = () => {
  const H = FLAP.hall * 100;
  return gameFloor({
    heroAt: [50, FLAP.y0],
    restAt: [50, FLAP.yTop - 12],
    restState: 'idle',
    light: [50, 50, 46],
    hall: FLAP.hall,
    world: {
      wall: 6,
      ledges: [
        ...LEDGES.map((l, i) => ({ x0: l.x0, x1: l.x1, y: hallY(l.alt), depth: i === 0 ? 10 : 3 })),
        { x0: 40, x1: 60, y: FLAP.yTop - 12, depth: 3 },
      ],
      throat: { y: FLAP.yTop - 6, gap: 12 },
    },
    // вход — пол зала (камера внизу), выход — сквозь горло с выступа над ним (камера наверху): стенки горла и есть стены
    ground: () => ({
      exit: [44, 44],
      ledges: [
        { x0: LEDGES[0].x0, x1: LEDGES[0].x1, y: FLAP.y0 },
        { x0: 40, x1: 60, y: FLAP.yTop - 12 },
      ],
    }),
    decorate: (ctx) => {
      // на втором круге снятые крылья так и висят на правом выступе
      if (ctx.lap === 2 && memory.get().wings === 'removed') {
        const w = img('assets/collage/wings.webp', 'cutout.hanging-wings');
        const perch = LEDGES.find((l) => l.alt > 0.5 && l.alt < 0.7) ?? LEDGES[1];
        w.style.left = `${(perch.x0 + perch.x1) / 2}%`;
        w.style.top = `${((hallY(perch.alt) - 14) / H) * 100}%`;
        (ctx.el.querySelector('.hall') ?? ctx.el).append(w);
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
  // идёт по уступу к правой стене, а не едет по воздуху
  const [rx, ry] = GHOST_PROPS.rope;
  ctx.light(rx - 4, ry + 20, 30);
  void ctx.hero.walkTo(rx - 4, 1400, ctx.signal).then(() => {
    if (ctx.signal.aborted) return;
    ctx.hero.flip(false);
    ctx.hero.set('held');
  });
};

export const floor6 = () =>
  gameFloor({
    heroAt: [30, 80],
    heroState: 'sit',
    light: [42, 66, 26],
    world: { ledges: [{ x0: 12, x1: 92, y: 80, depth: 10 }] },
    // взялся за верёвку — дальше по правой стене
    ground: (ctx) => (ctx.el.querySelector('.cavity.is-open') ? { side: 'right' } : {}),
    hasGame: (ctx) => ctx.lap === 1,
    decorate: (ctx) => {
      const [rx, ry] = GHOST_PROPS.rope;
      const rope = h('div.rope', { 'aria-hidden': 'true' });
      rope.style.left = `${rx}%`;
      rope.style.height = `${ry + 36}%`;
      const cavity = h('div.cavity', { 'aria-hidden': 'true' }, rope);
      ctx.el.append(cavity);
      if (memory.get().jar) {
        const jar = img('assets/collage/jar.webp', 'cutout.jar-light');
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
