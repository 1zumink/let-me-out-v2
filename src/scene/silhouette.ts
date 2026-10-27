// Мир-силуэт: стены ямы и уступы, залитые #050505, с неровными краями.
import type { Rng } from '../rng';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface Ledge {
  /** левый и правый край, верх уступа и толщина — в процентах слота */
  x0: number;
  x1: number;
  y: number;
  depth?: number;
}

export interface SilhouetteOptions {
  /** ширина стен по краям, % */
  wall?: number;
  ledges?: Ledge[];
  /** стеклянный потолок (финал): y нижней кромки, % */
  glass?: number;
  /** горло: стены сходятся до щели gap на высоте y, % */
  throat?: { y: number; gap: number };
  /** Высота мира в тех же единицах, что y: 100 — экран, 300 — зал на три экрана. */
  height?: number;
}

const jag = (rng: Rng, amp: number) => (rng() - 0.5) * amp;

/** Вертикальный неровный край: точки сверху вниз. */
function edge(rng: Rng, x: number, amp: number, height = 100): [number, number][] {
  const pts: [number, number][] = [];
  for (let y = -2; y <= height + 2; y += 3 + rng() * 3) pts.push([x + jag(rng, amp), y]);
  pts.push([x + jag(rng, amp), height + 2]);
  return pts;
}

const poly = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

export function silhouette(rng: Rng, { wall = 11, ledges = [], glass, throat, height = 100 }: SilhouetteOptions = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'silhouette');
  svg.setAttribute('viewBox', `0 0 100 ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');

  const left = edge(rng, wall, 3, height);
  const right = edge(rng, 100 - wall, 3, height).reverse();
  const shapes = [
    poly([[-1, -2], ...left, [-1, height + 2]]),
    poly([[101, height + 2], ...right, [101, -2]]),
    ...(throat
      ? [
          poly([[wall - 1, throat.y - 16], [50 - throat.gap / 2 + jag(rng, 1), throat.y - 1], [50 - throat.gap / 2 + jag(rng, 1), throat.y + 1], [wall - 1, throat.y + 12]]),
          poly([[101 - wall, throat.y - 14], [50 + throat.gap / 2 + jag(rng, 1), throat.y - 1], [50 + throat.gap / 2 + jag(rng, 1), throat.y + 1], [101 - wall, throat.y + 10]]),
        ]
      : []),
    ...ledges.map(({ x0, x1, y, depth = 5 }) => {
      const top: [number, number][] = [];
      for (let x = x0; x < x1; x += 2 + rng() * 3) top.push([x, y + jag(rng, 0.8)]);
      top.push([x1, y + jag(rng, 0.8)]);
      return poly([...top, [x1 - 1 + jag(rng, 2), y + depth], [x0 + 1 + jag(rng, 2), y + depth * 0.8]]);
    }),
  ];
  svg.innerHTML =
    shapes.map((p) => `<polygon points="${p}"/>`).join('') +
    (glass !== undefined
      ? `<g class="glass"><rect x="${wall - 2}" y="${glass - 3.2}" width="${104 - wall * 2}" height="3.2"/><path d="M${30 + jag(rng, 6)} ${glass - 3.2} l3 3.2 M${62 + jag(rng, 6)} ${glass - 3.2} l-2 3.2"/></g>`
      : '');
  return svg;
}
