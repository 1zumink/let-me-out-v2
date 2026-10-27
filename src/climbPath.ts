// Путь подъёма между местами: по уступу к стене, прыжок на стену, вверх по кромке, прыжок на уступ следующего места.
// Чистая геометрия без DOM: координаты в % игровой области, y — точка ног, считается в мире текущего места
// (следующее место лежит на 100 % выше). Прокрутка задаёт p от 0 до 1, путь отвечает позой.
import type { HeroState } from './hero/hero';

export type Side = 'left' | 'right';

/** Где герой стоит или висит в месте и за что там можно держаться. */
export interface Footing {
  /** Ширина левой и правой стены, %. */
  walls: [number, number];
  /** Уступ под ногами: края и верх. Нет — герой висит (на стене, под стеклом). */
  ledge?: { x0: number; x1: number; y: number };
  /** Поза: x и точка ног y, %. */
  x: number;
  y: number;
  state: HeroState;
  /** Какой стеной лезть отсюда или сюда; по умолчанию — ближней к герою. */
  side?: Side;
  /** Висит под потолком (стекло): последний отрезок — перехват руками вдоль потолка. */
  ceiling?: boolean;
}

/** Размер героя в % ширины и высоты игровой области. */
export interface HeroBox {
  w: number;
  h: number;
}

export type SegKind = 'walk' | 'jump' | 'wall' | 'mantle' | 'traverse';

export interface PathPose {
  x: number;
  y: number;
  state: HeroState;
  /** Фаза кадров ленты, 0…1 (у циклов — по пройденному пути). */
  t: number;
  /** Смотрит влево (лента отражена). */
  left: boolean;
  /** Сколько высоты уже пройдено, 0…1 — за этим идёт камера. */
  v: number;
  kind: SegKind;
}

interface Seg {
  kind: SegKind;
  from: [number, number];
  to: [number, number];
  /** Высота дуги прыжка, %. */
  arc?: number;
  len: number;
  p0: number;
  p1: number;
}

const STATE: Record<SegKind, HeroState> = { walk: 'walk', jump: 'jump', wall: 'wall', mantle: 'mantle', traverse: 'hang' };
/** Сколько % пути — один цикл ленты: шаг по уступу и перехват по стене. */
const STRIDE: Partial<Record<SegKind, number>> = { walk: 7, wall: 9, traverse: 8 };
/** Зазор меньше этого — шаг, а не прыжок. */
const GAP = 3;
/** Прыжок короткий по расстоянию, но читается дольше: столько «пути» он весит минимум. */
const JUMP_LEN = 10;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** x центра героя, когда он прижат к стене: руки и ноги на кромке. */
export function wallX(walls: [number, number], side: Side, box: HeroBox) {
  const inset = box.w * 0.28;
  return side === 'left' ? walls[0] + inset : 100 - walls[1] - inset;
}

/** Уступ упирается в стену этой стороны — на него не прыгают, а вылезают. */
const touches = (f: Footing, side: Side) =>
  !!f.ledge && (side === 'left' ? f.ledge.x0 <= f.walls[0] + GAP : f.ledge.x1 >= 100 - f.walls[1] - GAP);

/** Край уступа у стены, куда встают ногами. */
function ledgeEdge(f: Footing, side: Side, box: HeroBox) {
  const l = f.ledge!;
  const pad = box.w * 0.18;
  if (touches(f, side)) return wallX(f.walls, side, box) + (side === 'left' ? pad : -pad);
  return side === 'left' ? l.x0 + pad : l.x1 - pad;
}

export function pickSide(a: Footing, b: Footing): Side {
  return a.side ?? b.side ?? (a.x <= 50 ? 'left' : 'right');
}

export function climbPath(a: Footing, b: Footing, box: HeroBox) {
  const side = pickSide(a, b);
  const segs: Omit<Seg, 'p0' | 'p1' | 'len'>[] = [];
  const ax = wallX(a.walls, side, box);
  const bx = wallX(b.walls, side, box);
  const by = b.y - 100;
  let at: [number, number] = [a.x, a.y];
  const go = (kind: SegKind, to: [number, number], arc?: number) => {
    if (Math.hypot(to[0] - at[0], to[1] - at[1]) < 0.01) return;
    segs.push({ kind, from: at, to, arc });
    at = to;
  };

  // 1. От позы к стене: по уступу к краю, а с края — прыжком на стену
  if (Math.abs(a.x - ax) > 0.5) {
    if (a.ledge) {
      const edge = ledgeEdge(a, side, box);
      go('walk', [edge, a.y]);
      if (Math.abs(edge - ax) > GAP) go('jump', [ax, a.y - box.h * 0.35], box.h * 0.25);
      else go('wall', [ax, a.y - box.h * 0.1]);
    } else go('wall', [ax, a.y]);
  }

  // 2. Вверх по кромке; 3. на уступ следующего места — прыжком или через край
  if (b.ledge) {
    const edge = ledgeEdge(b, side, box);
    if (touches(b, side)) {
      // висит руками на кромке уступа и вылезает на неё
      go('wall', [bx, by + box.h * 0.55]);
      go('mantle', [edge, by]);
    } else {
      go('wall', [bx, by - box.h * 0.2]);
      go('jump', [edge, by], box.h * 0.3);
    }
    go('walk', [b.x, by]);
  } else if (b.ceiling) {
    // под стеклом: до потолка по стене, дальше перехватами руками
    go('wall', [bx, by]);
    go('traverse', [b.x, by]);
  } else {
    go('wall', [bx, by]);
    if (Math.abs(b.x - bx) > 0.5) go('wall', [b.x, by]);
  }

  // доли прокрутки — по длине отрезков; прыжок и вылезание весят не меньше JUMP_LEN
  let total = 0;
  const sized = segs.map((s) => {
    const d = Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]);
    const len = s.kind === 'jump' || s.kind === 'mantle' ? Math.max(d, JUMP_LEN) : d;
    total += len;
    return { ...s, len };
  });
  let acc = 0;
  const path: Seg[] = sized.map((s) => {
    const p0 = acc / (total || 1);
    acc += s.len;
    return { ...s, p0, p1: acc / (total || 1) };
  });

  const rise = a.y - by || 1;
  const segAt = (p: number) => path.find((s) => p < s.p1) ?? path[path.length - 1];

  function at_(p: number): PathPose {
    p = clamp01(p);
    const s = segAt(p);
    if (!s) return { x: b.x, y: by, state: b.state, t: 0, left: false, v: 1, kind: 'walk' };
    const u = clamp01((p - s.p0) / (s.p1 - s.p0 || 1));
    const x = lerp(s.from[0], s.to[0], u);
    const base = lerp(s.from[1], s.to[1], u);
    const y = base - (s.arc ? s.arc * 4 * u * (1 - u) : 0);
    const stride = STRIDE[s.kind];
    const t = stride ? ((s.len * u) / stride) % 1 : u;
    const dx = s.to[0] - s.from[0];
    // на стене лицом к стене; в шаге и прыжке — куда движется
    const left = s.kind === 'wall' || (s.kind === 'traverse' && Math.abs(dx) < 0.5) ? side === 'left' : dx < 0;
    return { x, y, state: STATE[s.kind], t, left, v: clamp01((a.y - base) / rise), kind: s.kind };
  }

  return {
    side,
    /** Длина пути в % — от неё зависит, сколько листать. */
    length: total,
    segments: path as readonly Seg[],
    at: at_,
    /** Отпустил здесь — куда герой доходит сам: прыжок и вылезание не обрываются в воздухе. */
    settle(p: number) {
      const s = segAt(clamp01(p));
      if (!s || p <= s.p0) return p;
      return s.kind === 'jump' || s.kind === 'mantle' ? s.p1 : p;
    },
  };
}

export type ClimbPath = ReturnType<typeof climbPath>;
