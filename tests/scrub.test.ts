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
  const log = { progress: [] as number[], done: 0, cancel: 0 };
  const s = createScrub({
    distance: () => 1000,
    instant: () => instant,
    onProgress: (p) => log.progress.push(p),
    onDone: () => log.done++,
    onCancel: () => log.cancel++,
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

  it('отпустил на трети — докатывается', () => {
    const { s, log } = make();
    s.drive(400);
    s.release();
    vi.advanceTimersByTime(2000);
    expect(log.done).toBe(1);
  });

  it('отпустил раньше — откатывается', () => {
    const { s, log } = make();
    s.drive(200);
    s.release();
    vi.advanceTimersByTime(2000);
    expect(log.cancel).toBe(1);
    expect(log.progress[log.progress.length - 1]).toBe(0);
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
});
