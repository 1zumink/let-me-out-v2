import type { GameType } from '../data';
import type { GameFactory } from './common';
import { createHold } from './hold';
import { createBreathe } from './breathe';
import { createLetgo } from './letgo';
import { createRemove } from './remove';
import { createFlap } from './flap';
import { createGhost } from './ghost';

export const games: Partial<Record<GameType, GameFactory>> = {
  hold: createHold,
  breathe: createBreathe,
  letgo: createLetgo,
  remove: createRemove,
  flap: createFlap,
  ghost: createGhost,
};
