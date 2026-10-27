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
  /** Узкий дымоход: вверх — распором между стенами, по центру. */
  chimney?: boolean;
}

/** Размер героя в % ширины и высоты игровой области. */
export interface HeroBox {
  w: number;
  h: number;
}

export type SegKind = 'walk' | 'jump' | 'wall' | 'mantle' | 'traverse' | 'chimney';

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
  /** Прыжок на стену: лента нарисована «со стены на уступ» — играем её назад, от стойки до полёта. */
  back?: boolean;
  len: number;
  p0: number;
  p1: number;
}

const STATE: Record<SegKind, HeroState> = { walk: 'walk', jump: 'jump', wall: 'wall', mantle: 'mantle', traverse: 'hang', chimney: 'chimney' };
/** Сколько % пути — один цикл ленты, от роста героя: два шага по уступу, перехваты по стене (цикл — на рост, не мельтешит),
 * распор в дымоходе, перехват руками под потолком. */
export const stride = (kind: SegKind, box: HeroBox) =>
  kind === 'walk' ? box.w * 0.55 : kind === 'wall' ? box.h * 0.9 : kind === 'chimney' ? box.h * 0.5 : kind === 'traverse' ? box.w * 0.4 : 0;
/** Зазор меньше этого — шаг, а не прыжок. */
const GAP = 3;
/** Прыжок короткий по расстоянию, но читается дольше: столько «пути» он весит минимум. */
const JUMP_LEN = 10;
/** Какую долю ленты прыжка играет прыжок на стену (с конца). */
const JUMP_BACK = 0.55;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** x центра героя, когда он прижат к стене: руки и ноги на кромке. Человечек в кадре узкий (лента wall — ~0.35…0.62 кадра),
 * поэтому от центра кадра до кромки — чуть больше десятой его ширины. */
export function wallX(walls: [number, number], side: Side, box: HeroBox) {
  const inset = box.w * 0.12;
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

/** Висит на стене — её и держится. Стоит на уступе — идёт к стене, которую ждёт следующее место:
 * на другую сторону переходят шагом по уступу, а не лазанием поперёк. */
export function pickSide(a: Footing, b: Footing): Side {
  const near: Side = a.x <= 50 ? 'left' : 'right';
  return a.ledge ? (b.side ?? a.side ?? near) : (a.side ?? b.side ?? near);
}

export function climbPath(a: Footing, b: Footing, box: HeroBox) {
  const side = pickSide(a, b);
  const segs: Omit<Seg, 'p0' | 'p1' | 'len'>[] = [];
  const ax = wallX(a.walls, side, box);
  const bx = wallX(b.walls, side, box);
  const by = b.y - 100;
  let at: [number, number] = [a.x, a.y];
  const go = (kind: SegKind, to: [number, number], arc?: number, back?: boolean) => {
    if (Math.hypot(to[0] - at[0], to[1] - at[1]) < 0.01) return;
    segs.push({ kind, from: at, to, arc, back });
    at = to;
  };

  const up: SegKind = a.chimney ? 'chimney' : 'wall';
  const toWall = side === 'left' ? -1 : 1;

  // 1. От позы к стене: по уступу к краю, а с края — прыжком на стену; из дымохода — сразу вверх
  if (!a.chimney && Math.abs(a.x - ax) > 0.5) {
    if (a.ledge) {
      const edge = ledgeEdge(a, side, box);
      go('walk', [edge, a.y]);
      if (Math.abs(edge - ax) > GAP) go('jump', [ax, a.y - box.h * 0.35], box.h * 0.25, true);
      else go('wall', [ax, a.y - box.h * 0.1]);
    } else go('wall', [ax, a.y]);
  }

  // 1б. Стык мест (y = 0): стены разной ширины. Шире свои — верх стены полка: вылез на неё и дошёл до новой стены.
  // Шире новые — нависают: под нависанием перехватами на руках. Иначе — просто вверх.
  const seamDy = box.h * 0.55; // вис: ноги на столько ниже кромки
  const inward = (ax - bx) * -toWall; // > 0 — своя стена ближе к середине
  if (Math.abs(ax - bx) > GAP && a.y > seamDy && by < 0) {
    if (inward > 0) {
      go(up, [at[0], seamDy]);
      const top = (side === 'left' ? a.walls[0] : 100 - a.walls[1]) + toWall * box.w * 0.15;
      go('mantle', [top, 0]);
      go('walk', [bx, 0]);
    } else {
      go(up, [at[0], box.h * 0.85]);
      go('traverse', [bx, box.h * 0.85]);
    }
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
    // вход на другой стене — так не задумано (проход сам встаёт к нашей стене, approach), но не телепорт: перехватами
    if (Math.abs(b.x - bx) > 0.5) go('traverse', [b.x, by]);
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
    // вылезание: сначала строго вверх у кромки (вис → подтянулся → грудь над краем), потом шаг на уступ
    const ux = s.kind === 'mantle' ? clamp01((u - 0.6) / 0.4) : u;
    const uy = s.kind === 'mantle' ? clamp01(u / 0.6) : u;
    const x = lerp(s.from[0], s.to[0], ux);
    const base = lerp(s.from[1], s.to[1], uy);
    const y = base - (s.arc ? s.arc * 4 * u * (1 - u) : 0);
    const k = stride(s.kind, box);
    // кадр 8 → ~4 из 8: стоит, присел, оттолкнулся, летит; дальше хватается и лезет лентой wall
    const t = k ? ((s.len * u) / k) % 1 : s.back ? 1 - u * JUMP_BACK : u;
    const dx = s.to[0] - s.from[0];
    // на стене лицом к стене; в шаге и прыжке — куда движется
    const left = s.kind === 'chimney' ? false : s.kind === 'wall' || (s.kind === 'traverse' && Math.abs(dx) < 0.5) ? side === 'left' : dx < 0;
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
