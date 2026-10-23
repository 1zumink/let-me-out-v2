// Цитата — надпись на стене: Caveat, свой наклон, неровная толщина, подтёк или зачёркнутое слово.
import { h } from '../dom';
import type { Quote } from '../data';
import { between, type Rng } from '../rng';
import { Footnote } from './Footnote';

let current: HTMLElement | null = null;

export function WallQuote(q: Quote, { x, y, rng }: { x: number; y: number; rng: Rng }) {
  // на экране не больше одной надписи
  current?.remove();

  const text = h('p.wall-quote__text', {});
  const words = q.text.split(/\s+/);
  const struck = q.strike ? words.findIndex((w) => w.replace(/[.,!?;:«»—]/g, '') === q.strike) : -1;
  const dripAt = struck < 0 ? Math.floor(rng() * words.length) : -1;
  words.forEach((w, i) => {
    const span = h(i === struck ? 's.wall-quote__word' : 'span.wall-quote__word', {}, w);
    span.style.setProperty('--w', String(Math.round(between(rng, 400, 700) / 100) * 100));
    span.style.setProperty('--r', `${between(rng, -1.5, 1.5).toFixed(2)}deg`);
    span.style.setProperty('--s', between(rng, 0.94, 1.08).toFixed(2));
    if (i === dripAt) span.classList.add('has-drip');
    text.append(span, i < words.length - 1 ? ' ' : '');
  });

  const el = h(
    'figure.wall-quote',
    {},
    text,
    h('figcaption.wall-quote__by', {}, `— ${q.by ?? q.author}`, Footnote(q)),
  );
  el.style.left = `${x}%`;
  el.style.top = `${y}%`;
  el.style.setProperty('--tilt', `${between(rng, -8, 6).toFixed(1)}deg`);
  // сноски длинные — чем больше слов, тем мельче почерк
  el.classList.toggle('wall-quote--long', words.length > 24);
  current = el;
  return {
    el,
    /** Надпись проявляется, когда до неё доходит свет. */
    light: () => el.classList.add('is-lit'),
    remove: () => {
      el.remove();
      if (current === el) current = null;
    },
  };
}
