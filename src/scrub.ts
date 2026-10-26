// Переход, который тянет прокрутка: p от 0 до 1. Отпустил на трети пути — докатывается, раньше — откатывается.
// Кнопка и стрелка проигрывают тот же путь сами.

export const COMMIT_AT = 0.35;
const PLAY_MS = 1400;

export interface ScrubOptions {
  /** Сколько пикселей прокрутки — весь путь. */
  distance: () => number;
  onProgress: (p: number) => void;
  onDone: () => void;
  onCancel?: () => void;
  /** reduced motion: без движения, сразу в конец. */
  instant?: () => boolean;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function createScrub(o: ScrubOptions) {
  let p = 0;
  let raf = 0;
  let animating = false;

  const set = (v: number) => {
    p = Math.min(1, Math.max(0, v));
    o.onProgress(p);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    animating = false;
  };
  const finish = () => {
    stop();
    set(1);
    p = 0;
    o.onDone();
  };
  const cancel = () => {
    stop();
    set(0);
    o.onCancel?.();
  };

  function animateTo(target: 0 | 1, ms: number) {
    stop();
    if (o.instant?.()) return target === 1 ? finish() : cancel();
    const from = p;
    const t0 = performance.now();
    animating = true;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / Math.max(ms, 1));
      set(from + (target - from) * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else if (target === 1) finish();
      else cancel();
    };
    raf = requestAnimationFrame(tick);
  }

  return {
    get progress() {
      return p;
    },
    get busy() {
      return animating || p > 0;
    },
    /** Прокрутка на delta пикселей (вверх — плюс). */
    drive(delta: number) {
      if (o.instant?.()) {
        if (delta > 0) finish();
        return;
      }
      stop();
      set(p + delta / o.distance());
      if (p >= 1) finish();
    },
    /** Жест закончился: докатить или откатить. */
    release() {
      if (animating || p === 0) return;
      if (p >= COMMIT_AT) animateTo(1, PLAY_MS * (1 - p));
      else animateTo(0, PLAY_MS * p);
    },
    /** Кнопка «выше» или стрелка: весь путь сам. */
    play() {
      animateTo(1, PLAY_MS * (1 - p));
    },
    reset() {
      stop();
      p = 0;
    },
  };
}

export type Scrub = ReturnType<typeof createScrub>;
