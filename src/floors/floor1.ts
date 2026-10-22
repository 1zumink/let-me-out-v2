// Этажи 1 и 7: «Держи». Герой висит на уступе, рука сверху его держит и поднимает.
import { gameFloor } from './gameFloor';

export const holdFloor = () =>
  gameFloor({
    heroAt: [50, 34],
    heroAnchor: 'hands',
    heroState: 'hang',
    restAt: [50, 34],
    restState: 'idle',
    world: { ledges: [{ x0: 36, x1: 64, y: 34, depth: 4 }, { x0: 14, x1: 40, y: 88, depth: 12 }] },
  });

export const floor1 = holdFloor;
