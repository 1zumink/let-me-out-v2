import type { Floor } from './types';
import { gameFloor } from './gameFloor';

export const floorModules: Record<string, () => Floor> = {
  game: () => gameFloor({ restState: 'idle' }),
};
