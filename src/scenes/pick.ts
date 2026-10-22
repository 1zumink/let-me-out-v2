// Правила выбора сайд-сцены (без DOM — покрыто тестами).
import type { Scene } from '../data';
import type { Rng } from '../rng';

export const SCENE_CHANCE = 0.4;

export interface PickInput {
  scenes: Scene[];
  lap: number;
  /** сцены, уже показанные в этом круге */
  seen: string[];
  /** на этом этаже сцена уже была */
  floorHadScene: boolean;
  rng: Rng;
}

/** Сцены, которые можно показать сейчас: свой круг, не виденные, вторая часть пары — только после первой. */
export function available({ scenes, lap, seen }: Pick<PickInput, 'scenes' | 'lap' | 'seen'>): Scene[] {
  return scenes.filter((s) => s.laps.includes(lap) && !seen.includes(s.id) && (!s.pairOf || seen.includes(s.pairOf)));
}

export function pickScene(input: PickInput): Scene | null {
  if (input.floorHadScene) return null;
  if (input.rng() >= SCENE_CHANCE) return null;
  const pool = available(input);
  if (!pool.length) return null;
  return pool[Math.floor(input.rng() * pool.length)];
}

export const sceneDuration = (words: number) => 4000 + 400 * words;
