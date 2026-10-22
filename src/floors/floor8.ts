// Этаж 8: стекло. Финал — «Отпусти».
import { gameFloor } from './gameFloor';

const GLASS_Y = 16;

export const floor8 = () =>
  gameFloor({
    heroAt: [50, GLASS_Y],
    heroAnchor: 'hands',
    heroState: 'hang',
    world: { glass: GLASS_Y },
  });
