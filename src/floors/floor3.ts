// Этаж 3: комната — главный коллажный экран, игра «Убрать».
import { gameFloor } from './gameFloor';

export const floor3 = () =>
  gameFloor({
    heroAt: [22, 84],
    restState: 'idle',
    quoteAt: [62, 30],
    light: [46, 62, 62],
    world: { wall: 8, ledges: [{ x0: 6, x1: 94, y: 84, depth: 16 }] },
  });
