// Reduced motion, пауза анимаций, live-область, фокус.
const forced = new URLSearchParams(location.search).get('motion') === 'reduce';
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

type MotionListener = () => void;
const listeners = new Set<MotionListener>();
let paused = false;
// анимации, которые поставили на паузу мы: чужие законченные не перезапускаем
let frozen: Animation[] = [];

const html = document.documentElement;
const sync = () => {
  html.classList.toggle('is-reduced', motion.reduced());
  html.classList.toggle('is-paused', paused);
  listeners.forEach((fn) => fn());
};
mq.addEventListener('change', sync);

export const motion = {
  reduced: () => forced || mq.matches,
  paused: () => paused,
  /** Кипящая линия, туман и т. п. — движется ли что-то само прямо сейчас. */
  still: () => forced || mq.matches || paused,
  onChange(fn: MotionListener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  init: sync,
};

export function setPaused(value: boolean) {
  paused = value;
  if (paused) {
    frozen = document.getAnimations().filter((a) => a.playState === 'running');
    frozen.forEach((a) => a.pause());
  } else {
    frozen.forEach((a) => a.playState === 'paused' && a.play());
    frozen = [];
  }
  sync();
}

let live: HTMLElement | null = null;
export function mountLive(parent: HTMLElement) {
  live = document.createElement('div');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('role', 'status');
  parent.append(live);
}

export function announce(text: string) {
  if (!live || !text) return;
  const el = live;
  el.textContent = '';
  // пустая пауза нужна, чтобы скринридер прочёл одинаковый текст повторно
  requestAnimationFrame(() => (el.textContent = text));
}

export function focus(el: HTMLElement | null | undefined) {
  el?.focus({ preventScroll: true });
}
