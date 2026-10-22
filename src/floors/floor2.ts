// Этаж 2: «Вдох».
import { gameFloor } from './gameFloor';

export const floor2 = () =>
  gameFloor({
    heroAt: [50, 78],
    restState: 'idle',
    world: { wall: 16, ledges: [{ x0: 30, x1: 70, y: 78, depth: 6 }] },
  });
