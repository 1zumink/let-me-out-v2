// Рукописные облачка с хвостиком к говорящему. Текст дублируется в live-область.
import { h } from '../dom';
import { announce, motion } from '../a11y';

export interface Speaker {
  el: HTMLElement;
}

const readMs = (text: string) => 1800 + text.length * 55;

export function createBubbles(layer: HTMLElement) {
  let current: { el: HTMLElement; skip: () => void } | null = null;

  function place(bubble: HTMLElement, who: HTMLElement) {
    const stage = layer.getBoundingClientRect();
    const r = who.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    const headX = r.left + r.width / 2 - stage.left;
    const top = r.top - stage.top + r.height * 0.05 - b.height - 18;
    const left = Math.min(Math.max(headX - b.width * 0.3, 12), stage.width - b.width - 12);
    bubble.style.left = `${left}px`;
    // герой мог уйти за кадр (падение) — облачко всё равно остаётся на экране
    const maxTop = stage.height - b.height - 96;
    bubble.style.top = `${Math.min(Math.max(top, 64), maxTop)}px`;
    bubble.style.setProperty('--tail-x', `${Math.min(Math.max(headX - left, 24), b.width - 24)}px`);
    // если над головой нет места — облачко уходит вниз, хвостик вверх
    bubble.classList.toggle('bubble--below', top < 64);
  }

  function show(text: string, who: Speaker, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const el = h('p.bubble', { 'aria-hidden': 'true' }, text);
      layer.append(el);
      place(el, who.el);
      announce(text);
      let left = readMs(text);
      let last = performance.now();
      let raf = 0;
      const tick = (now: number) => {
        if (!motion.paused()) left -= now - last;
        last = now;
        if (left <= 0) return done();
        raf = requestAnimationFrame(tick);
      };
      const done = () => {
        cancelAnimationFrame(raf);
        el.remove();
        if (current?.el === el) current = null;
        resolve();
      };
      el.addEventListener('pointerdown', done);
      signal?.addEventListener('abort', done);
      current = { el, skip: done };
      raf = requestAnimationFrame(tick);
    });
  }

  return {
    async say(lines: string[], who: Speaker, signal?: AbortSignal) {
      for (const line of lines) {
        if (signal?.aborted) return;
        await show(line, who, signal);
      }
    },
    skip: () => current?.skip(),
    clear() {
      current?.skip();
      layer.querySelectorAll('.bubble').forEach((b) => b.remove());
    },
  };
}

export type Bubbles = ReturnType<typeof createBubbles>;
