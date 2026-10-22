// Типовой этаж: силуэт, герой, игра из floors.json (или сценка), после игры — покой и надпись на стене.
import { games } from '../games';
import type { Game } from '../games/common';
import type { HeroState } from '../hero/hero';
import { quotes } from '../data';
import { silhouette, type SilhouetteOptions } from '../scene/silhouette';
import { WallQuote } from '../ui/WallQuote';
import type { Floor, FloorCtx } from './types';

export interface GameFloorOptions {
  heroAt?: [number, number];
  /** Висит — значит, (x, y) это точка рук, а не ног. */
  heroAnchor?: 'feet' | 'hands';
  heroState?: HeroState;
  /** Куда герой встаёт после игры. */
  restAt?: [number, number];
  restState?: HeroState;
  world?: SilhouetteOptions;
  /** Свет при входе: x, y, радиус; по умолчанию — над героем. */
  light?: [number, number, number];
  /** Где проявится цитата этажа. */
  quoteAt?: [number, number];
  decorate?: (ctx: FloorCtx) => void;
  /** Сценка для этажа без игры; должна вызвать ctx.done(). */
  script?: (ctx: FloorCtx) => void;
}

export function gameFloor(opts: GameFloorOptions = {}): Floor {
  let ctx: FloorCtx;
  let game: Game | null = null;
  let quote: ReturnType<typeof WallQuote> | null = null;
  const [x, y] = opts.heroAt ?? [50, 78];

  const showQuote = () => {
    const q = quotes.find((it) => it.id === ctx.data.quote);
    if (!q) return;
    const [qx, qy] = opts.quoteAt ?? [x > 50 ? 30 : 70, 34];
    quote = WallQuote(q, { x: qx, y: qy, rng: ctx.rng });
    ctx.el.append(quote.el);
    // свет доходит до надписи — она проявляется
    ctx.light(qx, qy, 30);
    ctx.after(700, () => quote?.light());
  };

  return {
    mount(c) {
      ctx = c;
      c.el.append(silhouette(c.rng, opts.world ?? { ledges: [{ x0: x - 22, x1: x + 22, y }] }));
      opts.decorate?.(c);
      const make = c.data.game ? games[c.data.game] : undefined;
      game = make ? make(c, () => c.done()) : null;
    },
    arrive() {
      ctx.hero.reset();
      ctx.hero.flip(false);
      ctx.hero.place(x, y, opts.heroAnchor);
      ctx.hero.set(opts.heroState ?? 'idle');
      if (opts.light) ctx.light(...opts.light);
      else ctx.light(x, opts.heroAnchor === 'hands' ? y + 14 : y - 18);
    },
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
      showQuote();
    },
    unmount() {
      game?.stop();
      quote?.remove();
      ctx.el.replaceChildren();
    },
  };
}
