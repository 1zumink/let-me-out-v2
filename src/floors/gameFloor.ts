// Типовой этаж: герой на месте, игра из floors.json, после игры — покой.
import { games } from '../games';
import type { Game } from '../games/common';
import type { HeroState } from '../hero/hero';
import type { Floor, FloorCtx } from './types';
import { silhouette, type SilhouetteOptions } from '../scene/silhouette';

export interface GameFloorOptions {
  heroAt?: [number, number];
  heroState?: HeroState;
  restState?: HeroState;
  world?: SilhouetteOptions;
  decorate?: (ctx: FloorCtx) => void;
}

export function gameFloor(opts: GameFloorOptions = {}): Floor {
  let ctx: FloorCtx;
  let game: Game | null = null;
  return {
    mount(c) {
      ctx = c;
      const [x, y] = opts.heroAt ?? [50, 78];
      c.el.append(silhouette(c.rng, opts.world ?? { ledges: [{ x0: x - 22, x1: x + 22, y }] }));
      opts.decorate?.(c);
    },
    arrive() {
      const [x, y] = opts.heroAt ?? [50, 78];
      ctx.hero.reset();
      ctx.hero.place(x, y);
      ctx.hero.set(opts.heroState ?? 'idle');
      ctx.light(x, y - 18);
    },
    start() {
      const make = ctx.data.game ? games[ctx.data.game] : undefined;
      if (!make) return ctx.done();
      game = make(ctx, () => ctx.done());
      game.start();
    },
    stop() {
      game?.stop();
      game = null;
      if (opts.restState) ctx.hero.set(opts.restState);
    },
    unmount() {
      game?.stop();
      ctx.el.replaceChildren();
    },
  };
}
