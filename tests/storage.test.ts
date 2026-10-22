import { describe, expect, it } from 'vitest';
import { storage } from '../src/storage';

// в node нет localStorage: каждое обращение падает и storage держит значение в памяти
describe('storage без localStorage', () => {
  it('держит значения в памяти и не бросает', () => {
    expect(storage.get('lmo.lap')).toBeNull();
    storage.set('lmo.lap', '2');
    expect(storage.get('lmo.lap')).toBe('2');
    storage.remove('lmo.lap');
    expect(storage.get('lmo.lap')).toBeNull();
  });
});
