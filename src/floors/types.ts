import type { Line, Place, Ui } from '../data';
import type { Hero } from '../hero/hero';
import type { Rng } from '../rng';
import type { Lap } from '../state';
import type { Action } from '../input';

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
  /** Клавиши, колесо и свайпы, пока место смонтировано. */
  on(action: Action, fn: () => void): void;
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

export interface Floor {
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
