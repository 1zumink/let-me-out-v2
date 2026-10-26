// Движок сайд-сцен S1–S12: на полях, только на остановках, не больше одной на место, каждая — раз за круг.
import { h, words } from '../dom';
import { announce, motion } from '../a11y';
import type { Place, Scene, SceneStep, Ui } from '../data';
import { memory } from '../memory';
import type { Rng } from '../rng';
import type { Store } from '../state';
import { Creature, type CreatureKind } from '../ui/Creature';
import { pickScene, sceneDuration } from './pick';
import { sceneTags } from '../route';


export function createSideScenes({ layer, store, scenes, rng, ui }: { layer: HTMLElement; store: Store; scenes: Scene[]; rng: Rng; ui: Ui }) {
  let shownAt: Record<string, string> = {};
  const placesWithScene = new Set<string>();
  let open: { close: () => void } | null = null;

  function show(scene: Scene) {
    const ac = new AbortController();
    const opts = { signal: ac.signal };
    const close = h('button.scene__close', { type: 'button', 'aria-label': ui.close }, '×');
    const body = h('div.scene__body');
    const card = h('aside.scene', { 'aria-label': scene.title }, close, body);
    if (scene.creature) card.insertBefore(Creature(scene.creature as CreatureKind, { x: 50, y: 50, size: 72, rng, signal: ac.signal }), body);
    if (scene.image)
      card.insertBefore(h('img.cutout.scene__image', { src: import.meta.env.BASE_URL + scene.image.src, alt: scene.image.alt, loading: 'lazy' }), body);
    layer.append(card);
    requestAnimationFrame(() => card.classList.add('is-in'));

    // таймер: 4 с + 0,4 с на слово видимого текста; стоит при фокусе, наведении и паузе анимаций
    let left = 0;
    let hover = false;
    let focused = false;
    let pending: { otherwise?: SceneStep[]; buttons: HTMLElement } | null = null;
    const grow = (text: string) => (left += sceneDuration(words(text)) - (left > 0 ? 4000 : 0));

    const render = (steps: SceneStep[]) => {
      let delay = 0;
      for (const step of steps) {
        if ('choice' in step) {
          const buttons = h('div.scene__choices');
          for (const opt of step.choice) {
            const b = h('button.btn.btn--small', { type: 'button' }, opt.label);
            b.addEventListener(
              'click',
              () => {
                buttons.remove();
                pending = null;
                if (opt.effect === 'jar') memory.set({ jar: true });
                render(opt.steps);
                if (!opt.steps.length) left = Math.min(left, 1500);
              },
              opts,
            );
            buttons.append(b);
          }
          body.append(buttons);
          pending = { otherwise: step.otherwise, buttons };
          grow(step.choice.map((c) => c.label).join(' '));
          return;
        }
        const line = h(
          'p.scene__line',
          {},
          step.who ? h('span.scene__who', {}, step.who) : null,
          h('span.scene__text', {}, step.text),
        );
        line.classList.toggle('scene__line--small', !!step.small);
        line.classList.toggle('scene__line--sign', !!step.sign);
        delay += step.delayMs ?? 0;
        if (delay && !motion.reduced()) {
          line.hidden = true;
          window.setTimeout(() => !ac.signal.aborted && ((line.hidden = false), announce(step.text)), delay);
        } else announce(`${step.who ? `${step.who}: ` : ''}${step.text}`);
        body.append(line);
        grow(step.text);
      }
    };
    render(scene.steps);

    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      if (!hover && !focused && !motion.paused()) left -= now - last;
      last = now;
      if (left <= 0) {
        // читатель не выбрал — сцена договаривает «иначе» (S1: «Ладно, я своим темпом»)
        if (pending?.otherwise) {
          pending.buttons.remove();
          const rest = pending.otherwise;
          pending = null;
          render(rest);
        } else return dismiss();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
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
      if (motion.reduced()) card.remove();
      else window.setTimeout(() => card.remove(), 400);
      if (open?.close === dismiss) open = null;
      if (hadFocus) document.querySelector<HTMLElement>('.btn--up:not([hidden])')?.focus();
    }
    open = { close: dismiss };
  }

  return {
    /** Вызывается на остановке места; сам решает, показывать ли сцену. route — маршрут этого круга. */
    maybeShow(placeData: Place, route: Place[]) {
      const s = store.get();
      if (s.phase !== 'stop' || open) return;
      const place = placeData.id;
      const key = `${s.lap}:${place}`;
      const scene = pickScene({
        scenes,
        lap: s.lap,
        place,
        tags: sceneTags(placeData),
        order: route.map((p) => p.id),
        shownAt,
        seenEver: memory.get().seenEver,
        floorHadScene: placesWithScene.has(key),
        rng,
      });
      placesWithScene.add(key);
      if (!scene) return;
      shownAt = { ...shownAt, [scene.id]: place };
      store.seeScene(scene.id);
      memory.see(scene.id);
      show(scene);
    },
    close: () => open?.close(),
    get isOpen() {
      return open !== null;
    },
    /** Новый круг: места снова могут получить сцену. */
    reset() {
      open?.close();
      placesWithScene.clear();
      shownAt = {};
    },
  };
}
