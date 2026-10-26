// Правила выбора сайд-сцены (без DOM — покрыто тестами).
import type { Scene } from '../data';
import type { Rng } from '../rng';

export const SCENE_CHANCE = 0.4;

export interface PickInput {
  scenes: Scene[];
  lap: number;
  /** id текущего места */
  place: string;
  /** теги места для where; по умолчанию — только id (у случайного прохода — «passage» и этаж под ним) */
  tags?: string[];
  /** порядок мест этого круга снизу вверх */
  order: string[];
  /** сцены, показанные в этом круге, и где */
  shownAt: Record<string, string>;
  /** сцены, увиденные за все круги */
  seenEver: string[];
  floorHadScene: boolean;
  rng: Rng;
}

const before = (order: string[], a: string, b: string) => order.indexOf(a) < order.indexOf(b);

/** Сцены, которые можно показать сейчас. */
export function available({ scenes, lap, place, tags = [place], order, shownAt, seenEver }: Omit<PickInput, 'rng' | 'floorHadScene'>): Scene[] {
  const prev = order[order.indexOf(place) - 1];
  return scenes.filter((s) => {
    if (!s.laps.includes(lap) || !s.where.some((w) => tags.includes(w)) || s.id in shownAt) return false;
    if (s.after && !before(order, s.after, place)) return false;
    if (!s.pairOf) return true;
    // отзвук через круг: первая часть была когда-то раньше
    if (s.crossLap) return seenEver.includes(s.pairOf) && !(s.pairOf in shownAt);
    // вторая часть — только после первой в этом круге; «soon» — строго на следующей остановке
    if (!(s.pairOf in shownAt)) return false;
    return s.soon ? shownAt[s.pairOf] === prev : true;
  });
}

export function pickScene(input: PickInput): Scene | null {
  if (input.floorHadScene) return null;
  const pool = available(input);
  // вторая часть «табличка» приходит без жребия — иначе шутка не сработает
  const due = pool.find((s) => s.soon);
  if (due) return due;
  if (input.rng() >= SCENE_CHANCE) return null;
  const rest = pool.filter((s) => !s.soon);
  if (!rest.length) return null;
  return rest[Math.floor(input.rng() * rest.length)];
}

export const sceneDuration = (words: number) => 4000 + 400 * words;
