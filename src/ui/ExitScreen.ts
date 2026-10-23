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

  const link = (dir: 'prev' | 'next') => {
    const w = webring[dir];
    const label = dir === 'prev' ? `← ${ui.webringPrev}` : `${ui.webringNext} →`;
    return h(
      'a.webring__link',
      { href: w.url, rel: dir },
      h('span.webring__dir', {}, label),
      h('span.webring__title', {}, w.title),
      w.about ? h('span.webring__about', {}, w.about) : null,
    );
  };

  const el = h(
    'section.exit',
    { 'aria-labelledby': 'exit-title', hidden: true },
    h(
      'div.exit__inner',
      {},
      title,
      h('div.exit__actions', {}, close, again),
      h('nav.webring', { 'aria-label': ui.webring }, link('prev'), link('next')),
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
