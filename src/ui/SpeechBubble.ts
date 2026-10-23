// Рукописные облачка с хвостиком к говорящему. Текст дублируется в live-область.
import { h } from '../dom';
import { announce, motion } from '../a11y';
import type { Line } from '../data';
import { beats, PAUSE_MS, type Beat } from '../lines';

const readMs = (text: string) => 1800 + text.length * 55;
const FLASH_MS = 700;

export function createBubbles(layer: HTMLElement) {
  const speakers = new Map<string, HTMLElement>();
  let current: { el: HTMLElement | null; skip: () => void } | null = null;

  function place(bubble: HTMLElement, who: HTMLElement) {
    const stage = layer.getBoundingClientRect();
    const r = who.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    const headX = r.left + r.width / 2 - stage.left;
    const top = r.top - stage.top + r.height * 0.05 - b.height - 18;
    const left = Math.min(Math.max(headX - b.width * 0.3, 12), stage.width - b.width - 12);
    bubble.style.left = `${left}px`;
    // говорящий мог уйти за кадр (падение) — облачко всё равно остаётся на экране
    const maxTop = stage.height - b.height - 96;
    bubble.style.top = `${Math.min(Math.max(top, 64), maxTop)}px`;
    bubble.style.setProperty('--tail-x', `${Math.min(Math.max(headX - left, 24), b.width - 24)}px`);
    // если над головой нет места — облачко уходит вниз, хвостик вверх
    bubble.classList.toggle('bubble--below', top < 64);
  }

  /** Таймер, который стоит, пока анимации на паузе. */
  function wait(ms: number, signal?: AbortSignal, onTick?: () => void) {
    return new Promise<void>((resolve) => {
      let left = ms;
      let last = performance.now();
      let raf = 0;
      const done = () => {
        cancelAnimationFrame(raf);
        signal?.removeEventListener('abort', done);
        resolve();
      };
      const tick = (now: number) => {
        if (!motion.paused()) left -= now - last;
        last = now;
        onTick?.();
        if (left <= 0) return done();
        raf = requestAnimationFrame(tick);
      };
      signal?.addEventListener('abort', done);
      current = { el: null, skip: done };
      raf = requestAnimationFrame(tick);
    });
  }

  function show(beat: Beat, signal?: AbortSignal): Promise<void> {
    if (beat.pause) return wait(PAUSE_MS, signal);
    const who = speakers.get(beat.who) ?? speakers.get('hero');
    const el = h('p.bubble', { 'aria-hidden': 'true' }, beat.text);
    el.classList.toggle('bubble--pale', !!beat.pale);
    el.classList.toggle('bubble--small', !!beat.small);
    layer.append(el);
    if (who) place(el, who);
    // вспышка: реплика появляется и сразу исчезает, не оставляя следа — в live-область не идёт
    if (!beat.flash) announce(beat.text);
    const p = wait(beat.flash ? FLASH_MS : readMs(beat.text), signal).then(() => {
      el.remove();
    });
    el.addEventListener('pointerdown', () => current?.skip());
    current = { el, skip: current!.skip };
    return p;
  }

  return {
    /** Регистрирует говорящего: облачка с who=name тянут хвостик к этому элементу. */
    speaker(name: string, el: HTMLElement | null) {
      if (el) speakers.set(name, el);
      else speakers.delete(name);
    },
    async say(lines: Line[], signal?: AbortSignal) {
      for (const beat of beats(lines)) {
        if (signal?.aborted) return;
        await show(beat, signal);
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
