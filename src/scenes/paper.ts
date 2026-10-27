// Клочок бумаги для сайд-сцены: рваный край и наклон по rng, чтобы ?seed= повторял один и тот же клочок.
import { between, type Rng } from '../rng';

/** Наклон клочка, градусы: ±4°, но не почти ровно — ровный клочок читается как плашка. */
export function paperTilt(rng: Rng) {
  const deg = between(rng, 1.2, 4);
  return rng() < 0.5 ? -deg : deg;
}

/**
 * clip-path рваного края: шумный полигон по периметру. Отступы в px от краёв, шаг в %,
 * поэтому клочок рвётся одинаково мелко при любой ширине. Низ оторван глубже — как от тетради.
 */
export function tornPolygon(rng: Rng, { top = 6, side = 5, bottom = 12 } = {}) {
  const pts: string[] = [];
  // соседние зубцы связаны: рваный край идёт волной с мелкой дрожью, а не пилой
  const edge = (n: number, depth: number, at: (t: number, d: number) => string) => {
    let d = between(rng, 0, depth);
    for (let i = 0; i < n; i++) {
      d = Math.min(depth, Math.max(0, d * 0.35 + between(rng, 0, depth) * 0.65 + (rng() < 0.12 ? depth * 0.5 : 0)));
      pts.push(at((i / n) * 100, d));
    }
  };
  const r = (v: number) => Math.round(v * 10) / 10;
  edge(30, top, (t, d) => `${r(t)}% ${r(d)}px`);
  edge(12, side, (t, d) => `calc(100% - ${r(d)}px) ${r(t)}%`);
  edge(36, bottom, (t, d) => `${r(100 - t)}% calc(100% - ${r(d)}px)`);
  edge(12, side, (t, d) => `${r(d)}px ${r(100 - t)}%`);
  return `polygon(${pts.join(', ')})`;
}
