import type { Floor } from './types';
import { gameFloor } from './gameFloor';
import * as places from './places';

export const floorModules: Record<string, () => Floor> = {
  game: () => gameFloor({ restState: 'idle' }),
  ...places,
};
