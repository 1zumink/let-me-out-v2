import { h } from '../dom';
import { focus } from '../a11y';
import type { Ui } from '../data';

/** Первый экран — договор с читателем. Начать: кнопка, стрелка ↑, прокрутка или свайп вверх. */
export function Intro(ui: Ui, onStart: () => void) {
  const start = h('button.btn.btn--up', { type: 'button' }, `${ui.intro.start} ↑`);
  start.addEventListener('click', onStart);
  const el = h(
    'section.intro',
    { 'aria-labelledby': 'intro-title' },
    h('h2.intro__title', { id: 'intro-title' }, ui.intro.title),
    h('p.intro__lead', {}, ui.intro.lead),
    h('p.intro__note', {}, ui.intro.note),
    start,
  );
  return {
    el,
    get isOpen() {
      return !el.hidden;
    },
    open() {
      el.hidden = false;
      focus(start);
    },
    close() {
      el.hidden = true;
    },
  };
}
