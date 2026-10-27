import type { Line, Place, Ui } from '../data';
import type { Hero, HeroState } from '../hero/hero';
import type { ScrollFn } from '../input';
import type { Rng } from '../rng';
import type { Lap } from '../state';
import type { Action } from '../input';
import type { Side } from '../climbPath';

export interface Hint {
  /** Запуск и любое действие игрока: гасит подсказку и перезапускает 20-секундный таймер. */
  poke(): void;
  stop(): void;
}

export interface FloorCtx {
  /** Слот места в мире; координаты внутри — в процентах. */
  el: HTMLElement;
  /** Панель кнопок под сценой. */
  controls: HTMLElement;
  data: Place;
  lap: Lap;
  hero: Hero;
  rng: Rng;
  ui: Ui;
  signal: AbortSignal;
  after(ms: number, fn: () => void): void;
  wait(ms: number): Promise<void>;
  /** Клавиши, пока место смонтировано. */
  on(action: Action, fn: () => void): void;
  /** Прокрутка (колесо, трекпад, палец), пока место смонтировано. */
  onScroll(fn: ScrollFn): void;
  say(lines: Line[]): Promise<void>;
  /** Реплики момента: второй круг подменяет первый, если у него есть такой ключ. */
  lines(key: string): Line[];
  /** Любые данные момента (карты реплик, параметры). */
  get<T>(key: string): T | undefined;
  /** Регистрирует говорящего для облачков. */
  speaker(name: string, el: HTMLElement | null): void;
  hint(): Hint;
  /** Тёплое пятно света: центр в процентах сцены, радиус в vmax; instant — без плавного перехода. */
  light(x: number, y: number, r?: number, instant?: boolean): void;
  /** Игра или сценка места закончена → фаза stop. */
  done(): void;
}

/** Поза героя: точка ног или рук в процентах игровой области и состояние. */
export interface Pose {
  x: number;
  y: number;
  anchor?: 'feet' | 'hands';
  state: HeroState;
}

/** За что держаться в месте: стены, уступы. По этому строится путь подъёма (climbPath.ts). */
export interface Ground {
  /** Ширина левой и правой стены, %. */
  walls: [number, number];
  /** Уступы: края и верх, %. */
  ledges: { x0: number; x1: number; y: number }[];
  /** Какой стеной лезть. */
  side?: Side;
  /** Вход висит под потолком (стекло): последний отрезок — перехватами вдоль потолка. */
  ceiling?: boolean;
  /** Отсюда выходят не по стене места, а через щель (горло): её края, как стены. */
  exit?: [number, number];
}

export interface Floor {
  /** Где и как герой оказывается, поднявшись сюда, — к этой позе ведёт прокрутка. */
  entry(): Pose;
  /** Стены и уступы места. */
  ground(): Ground;
  /** Строит место в слоте; камера ещё едет. */
  mount(ctx: FloorCtx): void;
  /** Камера приехала: расставить героя и свет. */
  arrive?(): void;
  /** Своё вступление вместо lines('enter'). */
  enterLines?(): Line[];
  /** Запускать ли игру места (на втором круге некоторые не запускаются). */
  hasGame?(): boolean;
  /** Игра — или сценка, если игры нет; в конце вызывает ctx.done(). */
  start(): void;
  stop(): void;
  /** Остановка: можно добавить свои кнопки рядом с «выше». */
  rest?(): void;
  unmount(): void;
}
