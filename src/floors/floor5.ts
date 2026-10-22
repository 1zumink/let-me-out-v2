// Этаж 5: крылья, игра «Взмах». Наверху горло — с крыльями не пролезть.
import { Creature } from '../ui/Creature';
import { gameFloor } from './gameFloor';

export const floor5 = () =>
  gameFloor({
    heroAt: [50, 80],
    restAt: [50, 26],
    restState: 'idle',
    world: { ledges: [{ x0: 32, x1: 68, y: 80, depth: 8 }, { x0: 40, x1: 60, y: 26, depth: 3 }], throat: { y: 32, gap: 14 } },
    decorate: (ctx) => ctx.el.append(Creature('bird', { x: 78, y: 52, size: 64, rng: ctx.rng, signal: ctx.signal })),
  });
