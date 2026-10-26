// Цитата — надпись на стене: Pangolin, свой наклон, неровная базовая линия, подтёк или зачёркнутое слово.
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
    span.style.setProperty('--r', `${between(rng, -0.6, 0.6).toFixed(2)}deg`);
    if (i === dripAt) span.classList.add('has-drip');
    text.append(span, i < words.length - 1 ? ' ' : '');
  });

  const el = h(
    'figure.wall-quote',
    {},
    text,
    h('figcaption.wall-quote__by', {}, `— ${q.by ?? q.author}`, Footnote(q)),
  );
  el.style.setProperty('--x', String(x));
  el.style.setProperty('--y', String(y));
  el.style.setProperty('--tilt', `${between(rng, -4, 3).toFixed(1)}deg`);
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
