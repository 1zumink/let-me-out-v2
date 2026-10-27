// Переход, который тянет прокрутка: p от 0 до 1. Отпустил посреди пути — стоит, где был: герой держится.
// Прыжок, начатый прокруткой, допрыгивается сам. Прокрутка вниз ведёт назад. Кнопка и стрелка проигрывают остаток пути сами.

const PLAY_MS = 1400;

export interface ScrubOptions {
  /** Сколько пикселей прокрутки — весь путь. */
  distance: () => number;
  onProgress: (p: number) => void;
  onDone: () => void;
  /** Прокрутили назад до самого начала и отпустили. */
  onCancel?: () => void;
  /** Отпустил посреди пути: герой держится, где был. */
  onRest?: (p: number) => void;
  /** Где можно остановиться, отпустив на p: прыжок не обрывается в воздухе — путь доходит сам. */
  settle?: (p: number) => number;
  /** Сколько мс кнопка «выше» играет весь путь; по умолчанию PLAY_MS. */
  playMs?: () => number;
  /** reduced motion: без движения, сразу в конец. */
  instant?: () => boolean;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function createScrub(o: ScrubOptions) {
  let p = 0;
  let raf = 0;
  let animating = false;
  let moved = false; // прокрутка двигала путь с последнего отпускания

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
    moved = false;
    o.onDone();
  };
  const cancel = () => {
    stop();
    set(0);
    o.onCancel?.();
  };

  function animateTo(target: number, ms: number, then: () => void) {
    stop();
    if (o.instant?.()) return target >= 1 ? finish() : (set(target), then());
    const from = p;
    const t0 = performance.now();
    animating = true;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / Math.max(ms, 1));
      set(from + (target - from) * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else if (target >= 1) finish();
      else {
        stop();
        then();
      }
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
      moved = true;
      set(p + delta / o.distance());
      if (p >= 1) finish();
    },
    /** Жест закончился: путь остаётся, где отпустили. */
    release() {
      if (animating || !moved) return;
      moved = false;
      if (p === 0) return cancel();
      const to = o.settle?.(p) ?? p;
      if (to > p) animateTo(to, Math.max(180, PLAY_MS * (to - p)), () => o.onRest?.(to));
      else o.onRest?.(p);
    },
    /** Кнопка «выше» или стрелка: остаток пути сам. */
    play() {
      animateTo(1, (o.playMs?.() ?? PLAY_MS) * (1 - p), finish);
    },
    reset() {
      stop();
      p = 0;
      moved = false;
    },
  };
}

export type Scrub = ReturnType<typeof createScrub>;
