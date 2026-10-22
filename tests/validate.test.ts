import { describe, expect, it } from 'vitest';
// @ts-expect-error — скрипт сборки на чистом JS
import { validateQuotes, validateScenes } from '../scripts/validate-data.mjs';

describe('валидатор данных', () => {
  it('цитата без source — ошибка', () => {
    const errors = validateQuotes([{ id: 'q1', text: 'Ад — это другие.', author: 'Сартр', source: '' }]);
    expect(errors.join()).toMatch(/source/);
  });

  it('полная цитата проходит', () => {
    expect(validateQuotes([{ id: 'q1', text: 'т', author: 'а', source: 'и', translator: 'п', page: '1' }])).toEqual([]);
  });

  it('pairOf должен ссылаться на существующую сцену', () => {
    expect(validateScenes([{ id: 'S2', text: 'т', laps: [1], pairOf: 'S1' }]).join()).toMatch(/pairOf/);
  });
});
