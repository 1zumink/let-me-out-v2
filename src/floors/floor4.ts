// Этаж 4: без игры. Герой лезет по стене, соскальзывает и повисает на уступе.
import { gameFloor } from './gameFloor';

const LEDGE_Y = 44;

export const floor4 = () =>
  gameFloor({
    heroAt: [50, 86],
    restAt: [30, LEDGE_Y],
    restState: 'idle',
    world: { ledges: [{ x0: 12, x1: 42, y: LEDGE_Y, depth: 4 }, { x0: 12, x1: 70, y: 86, depth: 12 }] },
    script(ctx) {
      const { hero } = ctx;
      hero.el.classList.add('is-slow');
      hero.set('climb');
      hero.place(44, LEDGE_Y + 2);
      ctx.light(42, LEDGE_Y);
      ctx.after(2600, () => {
        hero.set('slip');
        hero.place(44, LEDGE_Y + 14);
      });
      ctx.after(3400, () => {
        hero.el.classList.remove('is-slow');
        hero.set('hang');
        hero.place(44, LEDGE_Y - 1, 'hands');
      });
      ctx.after(5600, () => ctx.done());
    },
  });
