// Типовое место: силуэт, герой, игра из floors.json (или сценка), после игры — покой.
import { games } from '../games';
import type { Game } from '../games/common';
import type { HeroState } from '../hero/hero';
import type { Line } from '../data';
import { silhouette, type SilhouetteOptions } from '../scene/silhouette';
import { texturedWalls } from '../scene/textures';
import type { Floor, FloorCtx, Ground, Pose } from './types';

export interface GameFloorOptions {
  heroAt?: [number, number];
  /** Висит — значит, (x, y) это точка рук, а не ног. */
  heroAnchor?: 'feet' | 'hands';
  heroState?: HeroState;
  /** Куда герой встаёт после игры. */
  restAt?: [number, number];
  restState?: HeroState;
  world?: SilhouetteOptions;
  /** Своё к стенам и уступам силуэта: выступы этажа, сторона, горло. */
  ground?: (ctx: FloorCtx) => Partial<Ground>;
  /** Свет при входе: x, y, радиус; по умолчанию — над героем. */
  light?: [number, number, number];
  decorate?: (ctx: FloorCtx) => void;
  enterLines?: (ctx: FloorCtx) => Line[];
  hasGame?: (ctx: FloorCtx) => boolean;
  /** Сценка для места без игры; должна вызвать ctx.done(). */
  script?: (ctx: FloorCtx) => void;
  rest?: (ctx: FloorCtx) => void;
}

export function gameFloor(opts: GameFloorOptions = {}): Floor {
  let ctx: FloorCtx;
  let game: Game | null = null;
  const [x, y] = opts.heroAt ?? [50, 78];

  const world = opts.world ?? { ledges: [{ x0: x - 22, x1: x + 22, y }] };

  const entry = (): Pose => ({ x, y, anchor: opts.heroAnchor, state: opts.heroState ?? 'idle' });

  return {
    entry,
    ground: () => groundOf(world, opts.ground?.(ctx)),
    mount(c) {
      ctx = c;
      const walls = silhouette(c.rng, world);
      c.el.append(walls);
      opts.decorate?.(c);
      // фактура — после decorate: этажи дорисовывают в силуэт свои выступы
      const tex = texturedWalls(walls, (c.data.params as { texture?: string } | undefined)?.texture);
      if (tex) walls.after(tex);
      const make = c.data.game && (opts.hasGame?.(c) ?? true) ? games[c.data.game] : undefined;
      game = make ? make(c, () => c.done()) : null;
    },
    arrive() {
      // после подъёма герой уже стоит в позе входа и смотрит, куда шёл
      ctx.hero.reset();
      ctx.hero.put(x, y, opts.heroAnchor);
      ctx.hero.set(entry().state);
      if (opts.light) ctx.light(...opts.light);
      else ctx.light(x, opts.heroAnchor === 'hands' ? y + 14 : y - 18);
    },
    enterLines: opts.enterLines ? () => opts.enterLines!(ctx) : undefined,
    hasGame: () => game !== null,
    start() {
      if (game) game.start();
      else if (opts.script) opts.script(ctx);
      else ctx.done();
    },
    stop() {
      game?.stop();
      game = null;
      if (opts.restAt) {
        ctx.hero.place(...opts.restAt);
        ctx.light(opts.restAt[0], opts.restAt[1] - 18);
      }
      if (opts.restState) ctx.hero.set(opts.restState);
    },
    rest: opts.rest ? () => opts.rest!(ctx) : undefined,
    unmount() {
      game?.stop();
      ctx.el.replaceChildren();
    },
  };
}

/** Стены и уступы из силуэта; место дополняет своими. */
export function groundOf(world: SilhouetteOptions, extra: Partial<Ground> = {}): Ground {
  const w = world.wall ?? 11;
  return {
    walls: [w, w],
    ceiling: world.glass !== undefined,
    ...extra,
    ledges: [...(world.ledges ?? []).map(({ x0, x1, y }) => ({ x0, x1, y })), ...(extra.ledges ?? [])],
  };
}
