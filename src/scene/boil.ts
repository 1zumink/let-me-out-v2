// «Кипящая» линия: общие часы 7 fps переключают 3 варианта пути / фильтра.
import { motion } from '../a11y';
import type { Rng } from '../rng';

export const BOIL_VARIANTS = 3;
const FPS = 7;
const subs = new Set<(i: number) => void>();
let tick = 0;
let timer = 0;

function run() {
  clearInterval(timer);
  if (motion.still()) return;
  timer = window.setInterval(() => {
    tick = (tick + 1) % BOIL_VARIANTS;
    document.documentElement.dataset.boil = String(tick);
    subs.forEach((fn) => fn(tick));
  }, 1000 / FPS);
}

export function startBoilClock() {
  document.documentElement.dataset.boil = '0';
  motion.onChange(run);
  run();
}

export function onBoil(fn: (i: number) => void) {
  subs.add(fn);
  return () => subs.delete(fn);
}

/** Сдвигает каждое число в пути на ±amp/2 — так получается вариант той же линии. */
export function jitterPath(d: string, rng: Rng, amp = 1.6) {
  return d.replace(/-?\d+(\.\d+)?/g, (n) => (Number(n) + (rng() - 0.5) * amp).toFixed(1));
}

/** Привязывает к <path> варианты и переключает их по часам. */
export function boilPath(path: SVGPathElement, d: string, rng: Rng, amp?: number, signal?: AbortSignal) {
  const variants = [d, ...Array.from({ length: BOIL_VARIANTS - 1 }, () => jitterPath(d, rng, amp))];
  path.setAttribute('d', d);
  const off = onBoil((i) => path.setAttribute('d', variants[i]));
  signal?.addEventListener('abort', () => off(), { once: true });
  return off;
}
