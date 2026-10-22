import type { Floor } from './types';
import { gameFloor } from './gameFloor';
import { floor0 } from './floor0';
import { floor1 } from './floor1';
import { floor2 } from './floor2';
import { floor3 } from './floor3';
import { floor4 } from './floor4';
import { floor5 } from './floor5';
import { floor6 } from './floor6';
import { floor7 } from './floor7';
import { floor8 } from './floor8';

export const floorModules: Record<string, () => Floor> = {
  game: () => gameFloor({ restState: 'idle' }),
  floor0,
  floor1,
  floor2,
  floor3,
  floor4,
  floor5,
  floor6,
  floor7,
  floor8,
};
