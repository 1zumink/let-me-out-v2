// Движок сайд-сцен S1–S12: только в фазе stop, не больше одной на этаж, каждая — раз за круг.
import { h, words } from '../dom';
import { announce, motion } from '../a11y';
import type { Scene, Ui } from '../data';
import type { Rng } from '../rng';
import type { Store } from '../state';
import { Creature, type CreatureKind } from '../ui/Creature';
import { pickScene, sceneDuration } from './pick';

export function createSideScenes({ layer, store, scenes, rng, ui }: { layer: HTMLElement; store: Store; scenes: Scene[]; rng: Rng; ui: Ui }) {
  const floorsWithScene = new Set<string>();
  let open: { close: () => void } | null = null;

  function show(scene: Scene) {
    const ac = new AbortController();
    const close = h('button.scene__close', { type: 'button', 'aria-label': ui.close }, '×');
    const text = h('p.scene__text', {}, scene.text);
    const card = h('aside.scene', { 'aria-label': scene.id }, close, text);
    if (scene.creature) card.prepend(Creature(scene.creature as CreatureKind, { x: 50, y: 50, size: 72, rng, signal: ac.signal }));
    layer.append(card);
    announce(scene.text);
    requestAnimationFrame(() => card.classList.add('is-in'));

    // таймер стоит, пока на сцене фокус или наведение (и пока анимации на паузе)
    let left = sceneDuration(words(scene.text));
    let hover = false;
    let focused = false;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      if (!hover && !focused && !motion.paused()) left -= now - last;
      last = now;
      if (left <= 0) return dismiss();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const opts = { signal: ac.signal };
    card.addEventListener('pointerenter', () => (hover = true), opts);
    card.addEventListener('pointerleave', () => (hover = false), opts);
    card.addEventListener('focusin', () => (focused = true), opts);
    card.addEventListener('focusout', () => (focused = false), opts);
    close.addEventListener('click', () => dismiss(), opts);

    function dismiss() {
      if (ac.signal.aborted) return;
      ac.abort();
      cancelAnimationFrame(raf);
      const hadFocus = card.contains(document.activeElement);
      card.classList.remove('is-in');
      const remove = () => card.remove();
      if (motion.reduced()) remove();
      else window.setTimeout(remove, 400);
      if (open?.close === dismiss) open = null;
      if (hadFocus) document.querySelector<HTMLElement>('.btn--up:not([hidden])')?.focus();
    }
    open = { close: dismiss };
  }

  return {
    /** Вызывается в фазе stop; сам решает, показывать ли сцену (шанс 0.4). */
    maybeShow() {
      const s = store.get();
      if (s.phase !== 'stop' || open) return;
      const key = `${s.lap}:${s.floor}`;
      const scene = pickScene({ scenes, lap: s.lap, seen: s.seenScenes, floorHadScene: floorsWithScene.has(key), rng });
      floorsWithScene.add(key);
      if (!scene) return;
      store.seeScene(scene.id);
      show(scene);
    },
    close: () => open?.close(),
    get isOpen() {
      return open !== null;
    },
    /** Новый круг: этажи снова могут получить сцену. */
    reset() {
      open?.close();
      floorsWithScene.clear();
    },
  };
}
