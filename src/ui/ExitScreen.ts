// Экран выхода: текст, веб-ринг и кредиты. Открывается кнопкой «уйти».
import { h } from '../dom';
import { focus } from '../a11y';
import type { Ui, Webring } from '../data';
import { Credits } from './Credits';

export function ExitScreen(
  ui: Ui,
  webring: Webring,
  { onBack, onRestart }: { onBack: () => void; onRestart: () => void },
) {
  const title = h('h2.exit__title', { id: 'exit-title', tabindex: '-1' }, ui.exitTitle);
  const back = h('button.btn', { type: 'button' }, ui.back);
  const restart = h('button.btn', { type: 'button' }, ui.restart);
  back.addEventListener('click', onBack);
  restart.addEventListener('click', onRestart);

  const ring = h(
    'nav.webring',
    { 'aria-label': ui.webring },
    h('a.webring__link', { href: webring.prev.url, rel: 'prev' }, h('span.webring__dir', {}, `← ${ui.webringPrev}`), h('span', {}, webring.prev.title)),
    h('a.webring__link', { href: webring.next.url, rel: 'next' }, h('span.webring__dir', {}, `${ui.webringNext} →`), h('span', {}, webring.next.title)),
  );

  const el = h(
    'section.exit',
    { 'aria-labelledby': 'exit-title', hidden: true },
    h(
      'div.exit__inner',
      {},
      title,
      ...ui.exitText.map((p) => h('p.exit__text', {}, p)),
      h('div.exit__actions', {}, back),
      ring,
      Credits(ui),
      h('footer.exit__footer', {}, restart),
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
