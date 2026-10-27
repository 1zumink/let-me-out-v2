// Экран выхода и финальный экран: «закрыть», «ещё раз с начала», веб-ринг, источники и кредиты.
import { h } from '../dom';
import { focus } from '../a11y';
import type { Ui, Webring } from '../data';
import { Credits } from './Credits';

export function ExitScreen(
  ui: Ui,
  webring: Webring,
  { onClose, onAgain, onRestart }: { onClose: () => void; onAgain: () => void; onRestart: () => void },
) {
  const title = h('h2.exit__title', { id: 'exit-title', tabindex: '-1' }, ui.intro.title);
  const close = h('button.btn', { type: 'button' }, ui.close);
  const again = h('button.btn', { type: 'button' }, ui.again);
  const restart = h('button.btn.btn--small', { type: 'button' }, ui.restart);
  close.addEventListener('click', onClose);
  again.addEventListener('click', onAgain);
  restart.addEventListener('click', onRestart);

  // курсовой веб-ринг: разметка и классы — по общему шаблону курса (course-webring)
  const link = (w: { title: string; url: string | null }, text: string) =>
    w.url ? h('a', { href: w.url, target: '_top' }, text) : h('span.course-webring__soon', {}, text);
  const ring = h(
    'footer.course-webring',
    {},
    h('h2', {}, ui.webring),
    h(
      'nav.course-webring__nav',
      { 'aria-label': 'Веб-ринг проектов' },
      link(webring.prev, `← ${webring.prev.title}`),
      link(webring.all, webring.all.title),
      link(webring.next, `${webring.next.title} →`),
    ),
    h('nav.course-webring__nav.course-webring__nav--start', { 'aria-label': 'Маршрут по проектам' }, link(webring.start, `${webring.start.title} →`)),
  );

  const el = h(
    'section.exit',
    { 'aria-labelledby': 'exit-title', hidden: true },
    h(
      'div.exit__inner',
      {},
      title,
      h('div.exit__actions', {}, close, again),
      Credits(ui),
      h('div.exit__footer', {}, restart),
      ring,
    ),
  );

  return {
    el,
    open() {
      el.hidden = false;
      el.scrollTop = 0;
      focus(title);
    },
    close() {
      el.hidden = true;
    },
    get isOpen() {
      return !el.hidden;
    },
  };
}
