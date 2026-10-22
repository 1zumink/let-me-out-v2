import { h } from '../dom';
import { credits, quotes, type Ui } from '../data';

/** Кредиты собираются из credits.json и quotes.json. */
export function Credits(ui: Ui) {
  const people = h(
    'dl.credits__list',
    {},
    ...credits.flatMap((c) => [h('dt', {}, c.role), ...c.names.map((n) => h('dd', {}, n))]),
  );
  const cited = quotes.length
    ? h(
        'section.credits__quotes',
        { 'aria-labelledby': 'credits-quotes' },
        h('h3', { id: 'credits-quotes' }, ui.quotes),
        h(
          'ul',
          {},
          ...quotes.map((q) =>
            h(
              'li',
              {},
              `${q.author}. ${q.source}`,
              q.translator ? `, пер. ${q.translator}` : '',
              q.page ? `, с. ${q.page}` : '',
            ),
          ),
        ),
      )
    : null;
  return h('section.credits', { 'aria-labelledby': 'credits-title' }, h('h2', { id: 'credits-title' }, ui.credits), people, cited);
}
