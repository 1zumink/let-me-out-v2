import { describe, expect, it } from 'vitest';
import { memory } from '../src/memory';

// в node нет localStorage — память держится в процессе, ничего не бросает
describe('память второго круга', () => {
  it('запоминает комнату, крылья, банку и увиденные сцены', () => {
    memory.set({ roomRemoved: ['cup', 'lamp'], wings: 'folded', jar: true });
    memory.see('S1');
    memory.see('S1');
    memory.seeItem('jar');
    expect(memory.get()).toEqual({ roomRemoved: ['cup', 'lamp'], wings: 'folded', jar: true, seenEver: ['S1'], seenItems: ['jar'] });
  });

  it('«начать с нуля» стирает всё', () => {
    memory.reset();
    expect(memory.get()).toEqual({ roomRemoved: null, wings: null, jar: false, seenEver: [], seenItems: [] });
  });
});
