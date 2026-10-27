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
import { textureUrl } from '../scene/textures';
import { paperTilt, tornPolygon } from './paper';

// реплики выходят по одной: пауза перед следующей растёт с длиной предыдущей
const beat = (text: string) => Math.min(2400, 700 + 250 * words(text));


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
    // клочок бумаги: рваный край и наклон свои у каждой сцены, фактура paper — если автор её положил
    const tilt = paperTilt(rng);
    card.style.setProperty('--tilt', `${tilt.toFixed(1)}deg`);
    card.style.setProperty('--torn', tornPolygon(rng));
    const paper = textureUrl('paper');
    if (paper) card.style.setProperty('--paper', `url("${paper}")`);
    layer.append(card);
    // влетает чуть сбоку и сверху, крупнее (ближе к глазу), шлёпается о стену и прилипает
    if (!motion.reduced()) {
      const side = tilt < 0 ? -1 : 1;
      const at = (x: number, y: number, rot: number, scale: number) =>
        `translate(${x}px, ${y}px) rotate(${(tilt + rot).toFixed(1)}deg) scale(${scale})`;
      card.animate(
        [
          { opacity: 0, transform: at(side * 40, -70, side * 16, 1.2), filter: 'drop-shadow(0 22px 16px rgb(0 0 0 / 0.55))' },
          { opacity: 1, offset: 0.55, transform: at(0, 3, -side * 1.5, 0.97), filter: 'drop-shadow(0 2px 2px rgb(0 0 0 / 0.7))' },
          { offset: 0.8, transform: at(0, 0, side * 0.6, 1.01) },
          { transform: at(0, 0, 0, 1) },
        ],
        { duration: 700, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
      );
    }

    // таймер: 4 с + 0,4 с на слово видимого текста; стоит при фокусе, наведении и паузе анимаций
    let left = 0;
    let hover = false;
    let focused = false;
    let pending: { otherwise?: SceneStep[]; buttons: HTMLElement } | null = null;
    const grow = (text: string) => (left += sceneDuration(words(text)) - (left > 0 ? 4000 : 0));

    // строка или кнопки выходят через delay мс; при reduced motion — сразу все
    const reveal = (el: HTMLElement, delay: number, say: string) => {
      if (!delay || motion.reduced()) return announce(say);
      el.hidden = true;
      window.setTimeout(() => {
        if (ac.signal.aborted) return;
        el.hidden = false;
        el.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
        announce(say);
      }, delay);
      // пока строка ждёт своей очереди, таймер сцены её не съедает
      left += delay - shown;
      shown = delay;
    };
    let shown = 0;

    const render = (steps: SceneStep[]) => {
      let delay = 0;
      shown = 0;
      let prev = '';
      for (const step of steps) {
        if (prev) delay += beat(prev);
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
          reveal(buttons, delay, '');
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
        body.append(line);
        reveal(line, delay, `${step.who ? `${step.who}: ` : ''}${step.text}`);
        grow(step.text);
        prev = step.text;
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
      if (motion.reduced()) card.remove();
      else {
        // отклеивается: съезжает вниз и гаснет
        const out = card.animate(
          [{ opacity: 1 }, { opacity: 0, transform: `translate(0, 18px) rotate(${(tilt + 5).toFixed(1)}deg)` }],
          { duration: 350, easing: 'ease-in', fill: 'forwards' },
        );
        out.finished.then(() => card.remove(), () => card.remove());
      }
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
