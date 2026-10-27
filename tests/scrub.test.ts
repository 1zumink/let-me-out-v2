import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScrub } from '../src/scrub';

// rAF в node нет: подставляем таймер ~60 к/с
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
});
afterEach(() => vi.useRealTimers());

const make = (instant = false) => {
  const log = { progress: [] as number[], done: 0, cancel: 0, rest: 0 };
  const s = createScrub({
    distance: () => 1000,
    instant: () => instant,
    onProgress: (p) => log.progress.push(p),
    onDone: () => log.done++,
    onCancel: () => log.cancel++,
    onRest: () => log.rest++,
  });
  return { s, log };
};

describe('подъём за прокруткой', () => {
  it('прокрутка двигает прогресс пропорционально и назад тоже', () => {
    const { s } = make();
    s.drive(250);
    expect(s.progress).toBeCloseTo(0.25);
    s.drive(-100);
    expect(s.progress).toBeCloseTo(0.15);
  });

  it('отпустил на трети — стоит, где отпустил', () => {
    const { s, log } = make();
    s.drive(333);
    s.release();
    vi.advanceTimersByTime(2000);
    expect(s.progress).toBeCloseTo(0.333);
    expect(log.done).toBe(0);
    expect(log.cancel).toBe(0);
    expect(log.rest).toBe(1);
  });

  it('отпустил в самом начале — ничего не просит', () => {
    const { s, log } = make();
    s.release();
    expect(log.rest + log.cancel).toBe(0);
  });

  it('прокрутил назад до начала и отпустил — вернулся', () => {
    const { s, log } = make();
    s.drive(200);
    s.drive(-300);
    s.release();
    expect(log.cancel).toBe(1);
    expect(s.progress).toBe(0);
  });

  it('после остановки кнопка доходит до конца', () => {
    const { s, log } = make();
    s.drive(333);
    s.release();
    s.play();
    vi.advanceTimersByTime(1600);
    expect(log.done).toBe(1);
  });

  it('кнопка проигрывает весь путь сама', () => {
    const { s, log } = make();
    s.play();
    vi.advanceTimersByTime(1600);
    expect(log.done).toBe(1);
    expect(log.progress.length).toBeGreaterThan(10);
  });

  it('reduced motion — сразу в конец, без движения', () => {
    const { s, log } = make(true);
    s.drive(10);
    expect(log.done).toBe(1);
    expect(log.progress).toEqual([1]);
  });

  it('отпустил в прыжке — путь доходит до конца прыжка сам и там стоит', () => {
    const log = { rest: [] as number[], done: 0 };
    const s = createScrub({
      distance: () => 1000,
      onProgress: () => {},
      onDone: () => log.done++,
      onRest: (p) => log.rest.push(p),
      // прыжок — от 0.3 до 0.5
      settle: (p) => (p > 0.3 && p < 0.5 ? 0.5 : p),
    });
    s.drive(400);
    s.release();
    vi.advanceTimersByTime(1000);
    expect(s.progress).toBeCloseTo(0.5);
    expect(log.rest).toEqual([0.5]);
    expect(log.done).toBe(0);
  });
});
