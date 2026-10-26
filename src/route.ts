// Маршрут круга: этажи и тихий уступ стоят на своих местах, между ними — 4–5 случайных проходов,
// в каждом одна вещь из пула. В круге вещи не повторяются; на втором круге сначала те, что ещё не видел.
import type { CollageItem, Place } from './data';
import type { Rng } from './rng';

export interface PassageItem {
  id: string;
  label: string;
  src: string;
  line: string;
  w: number;
}

export interface PassagePool {
  outro: string[];
  items: PassageItem[];
}

export interface RouteInput {
  /** этажи и уступ в порядке снизу вверх */
  places: Place[];
  pool: PassagePool;
  rng: Rng;
  /** вещи, увиденные на прошлых кругах */
  seenItems: string[];
  min?: number;
  max?: number;
}

const LEDGE = 'p-ledge';
// до этого этажа шахта из бетонных колец, выше — земля с корнями
const RINGS_BELOW = 'f2';

function shuffle<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Промежутки, куда может встать проход: между двумя соседними этажами, не рядом с уступом. */
export function gaps(places: Place[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < places.length - 1; i++) {
    const a = places[i];
    const b = places[i + 1];
    if (a.kind === 'floor' && b.kind === 'floor') out.push(i);
  }
  return out;
}

export function buildRoute({ places, pool, rng, seenItems, min = 4, max = 5 }: RouteInput): Place[] {
  const slots = gaps(places);
  const count = Math.min(slots.length, pool.items.length, min + Math.floor(rng() * (max - min + 1)));
  const chosen = new Set(shuffle(slots, rng).slice(0, count));
  // сначала невиданные вещи, каждая группа перемешана
  const fresh = shuffle(pool.items.filter((it) => !seenItems.includes(it.id)), rng);
  const old = shuffle(pool.items.filter((it) => seenItems.includes(it.id)), rng);
  const items = [...fresh, ...old];
  const ringsUntil = places.findIndex((p) => p.id === RINGS_BELOW);

  const route: Place[] = [];
  let n = 0;
  places.forEach((place, i) => {
    route.push(place);
    if (!chosen.has(i)) return;
    const item = items[n];
    const first = n === 0;
    n++;
    const left = rng() < 0.5;
    const cut: CollageItem = { id: item.id, label: item.label, src: item.src, x: left ? 28 : 72, y: 38, w: item.w };
    route.push({
      id: `p-${item.id}`,
      kind: 'passage',
      label: 'проход',
      module: 'passage',
      game: null,
      collage: [cut],
      params: { texture: i < ringsUntil ? 'rings' : 'earth', below: place.id },
      // «Кто-то тут жил…» — после первого прохода круга
      lines: { lap1: { items: { [item.id]: item.line }, outro: first ? pool.outro : [] } },
    });
  });
  if (!route.some((p) => p.id === LEDGE)) throw new Error('маршрут без тихого уступа');
  return route;
}

/** Теги места для сайд-сцен: сам id; у случайного прохода — «passage» и этаж прямо под ним. */
export function sceneTags(place: Place): string[] {
  const below = (place.params as { below?: string } | undefined)?.below;
  return below ? ['passage', below] : [place.id];
}
