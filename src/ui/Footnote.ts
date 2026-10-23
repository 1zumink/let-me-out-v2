import { h } from '../dom';
import type { Quote } from '../data';

let n = 0;

/** Мелкая сноска к надписи: по нажатию раскрывает источник, перевод и страницу. */
export function Footnote(q: Quote) {
  const id = `fn-${++n}`;
  const details = [q.author, q.source, q.translator && `пер. ${q.translator}`, q.page && `с. ${q.page}`].filter(Boolean).join(', ');
  const btn = h('button.footnote__mark', { type: 'button', 'aria-expanded': 'false', 'aria-controls': id, 'aria-label': `источник: ${q.author}` }, '*');
  const note = h('span.footnote__text', { id, hidden: true }, details);
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    note.hidden = !open;
  });
  return h('span.footnote', {}, btn, note);
}
