import type { FloorCtx } from '../floors/types';

export interface Game {
  start(): void;
  stop(): void;
}

export type GameFactory = (ctx: FloorCtx, onDone: () => void) => Game;

/** Всё, что создала игра (узлы, слушатели, таймеры), убирается одним dispose(). */
export function scope(ctx: FloorCtx) {
  const ac = new AbortController();
  ctx.signal.addEventListener('abort', () => ac.abort(), { once: true });
  const nodes: Element[] = [];
  const timers = new Set<number>();
  return {
    signal: ac.signal,
    own<T extends Element>(el: T): T {
      nodes.push(el);
      return el;
    },
    after(ms: number, fn: () => void) {
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (!ac.signal.aborted) fn();
      }, ms);
      timers.add(id);
      return id;
    },
    clear(id: number) {
      clearTimeout(id);
      timers.delete(id);
    },
    dispose() {
      ac.abort();
      timers.forEach(clearTimeout);
      timers.clear();
      nodes.forEach((n) => n.remove());
    },
  };
}
