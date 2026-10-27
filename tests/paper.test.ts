import { describe, expect, it } from 'vitest';
import { paperTilt, tornPolygon } from '../src/scenes/paper';
import { mulberry32 } from '../src/rng';

describe('клочок бумаги сцены', () => {
  it('наклон в пределах ±4° и не ровный', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      const t = Math.abs(paperTilt(rng));
      expect(t).toBeGreaterThanOrEqual(1.2);
      expect(t).toBeLessThanOrEqual(4);
    }
  });

  it('рваный край повторяется по сиду и не глубже заданного', () => {
    expect(tornPolygon(mulberry32(5))).toBe(tornPolygon(mulberry32(5)));
    expect(tornPolygon(mulberry32(5))).not.toBe(tornPolygon(mulberry32(6)));
    const px = [...tornPolygon(mulberry32(9), { top: 5, side: 4, bottom: 9 }).matchAll(/([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(px.length).toBeGreaterThan(40);
    expect(Math.max(...px)).toBeLessThanOrEqual(9);
  });
});
