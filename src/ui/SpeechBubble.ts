// Рукописные облачка с хвостиком к говорящему. Текст дублируется в live-область.
import { h } from '../dom';
import { announce, motion } from '../a11y';
import type { Line } from '../data';
import { beats, PAUSE_MS, type Beat } from '../lines';

const readMs = (text: string) => 1800 + text.length * 55;
const FLASH_MS = 700;
/** Прокрутка — темп чтения: каждый пиксель вверх съедает столько мс у текущего облачка или паузы. */
const MS_PER_PX = 25;

export function createBubbles(layer: HTMLElement) {
  const speakers = new Map<string, HTMLElement>();
  let current: { el: HTMLElement | null; skip: () => void; hurry: (ms: number) => void } | null = null;
  // сколько реплик и пауз идёт сейчас: пока идут, прокрутка читает их, а не ведёт героя
  let live = 0;

  function place(bubble: HTMLElement, who: HTMLElement) {
    const stage = layer.getBoundingClientRect();
    const r = who.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    const headX = r.left + r.width / 2 - stage.left;
    const top = r.top - stage.top + r.height * 0.05 - b.height - 18;
    // не выше кнопок шапки: на узком экране она в две строки
    const hud = layer.parentElement?.querySelector('.hud')?.getBoundingClientRect();
    const minTop = Math.max(64, hud ? hud.bottom - stage.top + 8 : 0);
    const left = Math.min(Math.max(headX - b.width * 0.3, 12), stage.width - b.width - 12);
    bubble.style.left = `${left}px`;
    // говорящий мог уйти за кадр (падение) — облачко всё равно остаётся на экране
    const dock = layer.parentElement?.querySelector('.dock')?.getBoundingClientRect();
    const maxTop = (dock ? Math.min(dock.top - stage.top, stage.height - 96) : stage.height - 96) - b.height - 8;
    // над головой нет места — облачко под головой, а не прижато к шапке
    const below = r.top - stage.top + r.height * 0.4 + 12;
    bubble.style.top = `${Math.min(Math.max(top < minTop ? below : top, minTop), maxTop)}px`;
    bubble.style.setProperty('--tail-x', `${Math.min(Math.max(headX - left, 24), b.width - 24)}px`);
    // если над головой нет места — облачко уходит вниз, хвостик вверх
    bubble.classList.toggle('bubble--below', top < minTop);
  }

  /** Таймер, который стоит, пока анимации на паузе. */
  function wait(ms: number, signal?: AbortSignal, onTick?: () => void) {
    return new Promise<void>((resolve) => {
      let left = ms;
      let last = performance.now();
      let raf = 0;
      let over = false;
      const done = () => {
        if (over) return;
        over = true;
        live--;
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
      // прокрутка дочитала — реплика уходит сразу, не дожидаясь кадра
      const hurry = (by: number) => {
        left -= by;
        if (left <= 0) done();
      };
      live++;
      signal?.addEventListener('abort', done);
      current = { el: null, skip: done, hurry };
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
    current = { ...current!, el };
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
    /** Идёт реплика или пауза. */
    get active() {
      return live > 0;
    },
    skip: () => current?.skip(),
    /** Прокрутили вверх на px: текущая реплика или пауза проходит быстрее — чем быстрее листают, тем быстрее читают. */
    read: (px: number) => current?.hurry(px * MS_PER_PX),
    clear() {
      current?.skip();
      layer.querySelectorAll('.bubble').forEach((b) => b.remove());
    },
  };
}

export type Bubbles = ReturnType<typeof createBubbles>;
