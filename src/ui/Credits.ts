import { h } from '../dom';
import { credits, quotes, type Ui } from '../data';

/** Источники и кредиты собираются из quotes.json и credits.json. */
export function Credits(ui: Ui) {
  const sources = [...new Map(quotes.map((q) => [`${q.author}|${q.source}`, q])).values()];
  return h(
    'section.credits',
    { 'aria-labelledby': 'credits-title' },
    h('h3', { id: 'credits-title' }, ui.credits),
    sources.length
      ? h(
          'section.credits__quotes',
          { 'aria-labelledby': 'credits-quotes' },
          h('h4', { id: 'credits-quotes' }, ui.quotes),
          h(
            'ul',
            {},
            ...sources.map((q) =>
              h('li', {}, `${q.author}, ${q.source}`, q.translator ? `, пер. ${q.translator}` : '', q.page ? `, с. ${q.page}` : ''),
            ),
          ),
        )
      : null,
    h('dl.credits__list', {}, ...credits.flatMap((c) => [h('dt', {}, c.role), ...c.names.map((n) => h('dd', {}, n))])),
  );
}
