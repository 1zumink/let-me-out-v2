import { describe, expect, it } from 'vitest';
import { BREATH, atTop, createClimb, dim, inhale, step, type Climb } from '../src/games/breathePhysics';

const FRAME = 16;

/** Вдохи каждые every мс (0 — ни одного), ms мс. */
function breathe(c: Climb, every: number, ms: number) {
  let next = 0;
  for (let t = 0; t < ms; t += FRAME) {
    if (every && t >= next) {
      inhale(c);
      next += every;
    }
    step(c, FRAME);
  }
}

describe('breathePhysics', () => {
  it('спокойный ритм — подъём около 30 с', () => {
    const c = createClimb();
    breathe(c, 1500, 27_000);
    expect(atTop(c)).toBe(false);
    breathe(c, 1500, 4_000);
    expect(atTop(c)).toBe(true);
    expect(c.slips).toBe(0);
  });

  it('частые тапы не быстрее одного вдоха в inhaleMs', () => {
    const c = createClimb();
    breathe(c, 100, 10_000);
    expect(c.breaths).toBeLessThanOrEqual(10_000 / BREATH.inhaleMs + 1);
    expect(c.p).toBeLessThan(0.55);
  });

  it('без вдоха > 3 с — темно, но ещё не срыв', () => {
    const c = createClimb();
    breathe(c, 1500, 6_000);
    const p = c.p;
    breathe(c, 0, 3_500);
    expect(dim(c)).toBe(true);
    expect(c.slipping).toBe(false);
    expect(c.p).toBeCloseTo(p, 5);
  });

  it('вдох снимает темноту', () => {
    const c = createClimb();
    breathe(c, 1500, 3_000);
    breathe(c, 0, 4_000);
    expect(dim(c)).toBe(true);
    inhale(c);
    expect(dim(c)).toBe(false);
  });

  it('без вдоха > 6 с — съезжает к началу плавно, без скачков', () => {
    const c = createClimb();
    breathe(c, 1500, 12_000);
    const top = c.p;
    expect(top).toBeGreaterThan(0.3);
    let prev = c.p;
    let maxDrop = 0;
    for (let t = 0; t < 10_000; t += FRAME) {
      step(c, FRAME);
      maxDrop = Math.max(maxDrop, prev - c.p);
      prev = c.p;
    }
    expect(c.slips).toBe(1);
    expect(c.p).toBe(0);
    expect(c.slipping).toBe(false);
    expect(maxDrop).toBeLessThan(0.02);
  });

  it('во время срыва вдохи не засчитываются', () => {
    const c = createClimb();
    breathe(c, 1500, 9_000);
    breathe(c, 0, 4_600);
    expect(c.slipping).toBe(true);
    expect(inhale(c)).toBe(false);
  });

  it('пока часы стоят (герой говорит), срыва нет', () => {
    const c = createClimb();
    breathe(c, 1500, 9_000);
    for (let t = 0; t < 10_000; t += FRAME) step(c, FRAME, true);
    expect(dim(c)).toBe(false);
    expect(c.slipping).toBe(false);
  });

  it('пока часы стоят, вдохи засчитываются', () => {
    const c = createClimb();
    let n = 0;
    for (let t = 0; t < 6_000; t += FRAME) {
      if (t % 1504 === 0 && inhale(c)) n++;
      step(c, FRAME, true);
    }
    expect(n).toBe(4);
  });

  it('у начала коридора срываться некуда', () => {
    const c = createClimb();
    breathe(c, 0, 10_000);
    expect(dim(c)).toBe(true);
    expect(c.slips).toBe(0);
  });
});
