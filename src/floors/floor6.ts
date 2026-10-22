// Этаж 6: «Без тела». Тело остаётся на уступе, призрак ищет щель света.
import { gameFloor } from './gameFloor';

export const floor6 = () =>
  gameFloor({
    heroAt: [30, 80],
    restState: 'idle',
    quoteAt: [66, 58],
    world: { ledges: [{ x0: 12, x1: 56, y: 80, depth: 10 }] },
  });
