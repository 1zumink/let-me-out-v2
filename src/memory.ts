// Что второй круг помнит о первом. Хранится в localStorage через storage (с запасным вариантом в памяти).
import { storage } from './storage';

export interface Memory {
  /** вещи, убранные в комнате; null — в комнате ещё не были */
  roomRemoved: string[] | null;
  wings: 'folded' | 'removed' | null;
  /** банка со светом из сцены S3 */
  jar: boolean;
  /** сцены, увиденные за все круги (для отзвуков на втором круге) */
  seenEver: string[];
  /** вещи из проходов, увиденные за все круги — на следующем сначала другие */
  seenItems: string[];
}

export const MEMORY_KEY = 'lmo.memory';
const empty = (): Memory => ({ roomRemoved: null, wings: null, jar: false, seenEver: [], seenItems: [] });

function load(): Memory {
  try {
    const raw = storage.get(MEMORY_KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

let state = load();

export const memory = {
  get: (): Readonly<Memory> => state,
  set(patch: Partial<Memory>) {
    state = { ...state, ...patch };
    storage.set(MEMORY_KEY, JSON.stringify(state));
  },
  see(id: string) {
    if (!state.seenEver.includes(id)) memory.set({ seenEver: [...state.seenEver, id] });
  },
  seeItem(id: string) {
    if (!state.seenItems.includes(id)) memory.set({ seenItems: [...state.seenItems, id] });
  },
  reset() {
    state = empty();
    storage.remove(MEMORY_KEY);
  },
};
