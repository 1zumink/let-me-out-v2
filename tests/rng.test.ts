import { describe, expect, it } from 'vitest';
import { mulberry32, seedFromUrl } from '../src/rng';

describe('rng', () => {
  it('один сид — одна последовательность', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const xs = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(xs);
    xs.forEach((x) => expect(x).toBeGreaterThanOrEqual(0));
    xs.forEach((x) => expect(x).toBeLessThan(1));
  });

  it('читает ?seed= из URL', () => {
    expect(seedFromUrl('?seed=123')).toBe(123);
    expect(Number.isInteger(seedFromUrl(''))).toBe(true);
  });
});
