import type { GameType } from '../data';
import type { GameFactory } from './common';
import { createHold } from './hold';
import { createBreathe } from './breathe';
import { createLetgo } from './letgo';

export const games: Partial<Record<GameType, GameFactory>> = {
  hold: createHold,
  breathe: createBreathe,
  letgo: createLetgo,
};
