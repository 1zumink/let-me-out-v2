// Этаж 0: дно ямы. Игры нет — герой стоит, рядом улитка.
import { Creature } from '../ui/Creature';
import { gameFloor } from './gameFloor';

export const floor0 = () =>
  gameFloor({
    heroAt: [50, 80],
    world: { ledges: [{ x0: 8, x1: 92, y: 80, depth: 22 }] },
    decorate: (ctx) => ctx.el.append(Creature('snail', { x: 70, y: 77, size: 56, rng: ctx.rng, signal: ctx.signal })),
  });
