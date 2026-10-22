import type { FloorData, Ui } from '../data';
import type { Hero } from '../hero/hero';
import type { Rng } from '../rng';
import type { Lap } from '../state';

export interface Hint {
  /** Любое действие игрока: прячет подсказку и перезапускает 20-секундный таймер. */
  poke(): void;
  stop(): void;
}

export interface FloorCtx {
  /** Слот этажа в мире; координаты внутри — в процентах. */
  el: HTMLElement;
  /** Панель кнопок-альтернатив под сценой. */
  controls: HTMLElement;
  data: FloorData;
  lap: Lap;
  hero: Hero;
  rng: Rng;
  ui: Ui;
  signal: AbortSignal;
  after(ms: number, fn: () => void): void;
  say(lines: string[]): Promise<void>;
  lines(key: string): string[];
  hint(): Hint;
  /** Тёплое пятно света: центр в процентах сцены, радиус в vmax. */
  light(x: number, y: number, r?: number): void;
  /** Игра этажа закончена → фаза stop. */
  done(): void;
}

export interface Floor {
  /** Строит этаж в слоте; камера ещё едет. */
  mount(ctx: FloorCtx): void;
  /** Камера приехала: расставить героя и свет. */
  arrive?(): void;
  start(): void;
  stop(): void;
  unmount(): void;
}
