export type Phase = 'enter' | 'play' | 'stop' | 'exit';
export type Lap = 1 | 2;

export interface GameState {
  floor: number;
  phase: Phase;
  lap: Lap;
  seenScenes: string[];
}

// enter → play (если на этаже игра) → stop → exit → enter следующего этажа
const NEXT: Record<Phase, Phase[]> = {
  enter: ['play', 'stop'],
  play: ['stop'],
  stop: ['exit'],
  exit: ['enter'],
};

export type Listener = (s: GameState, prev: GameState) => void;

export function createStore(init: Partial<GameState> = {}) {
  let s: GameState = { floor: 0, phase: 'enter', lap: 1, seenScenes: [], ...init };
  const subs = new Set<Listener>();
  const commit = (next: GameState) => {
    const prev = s;
    s = next;
    subs.forEach((fn) => fn(s, prev));
  };

  return {
    get: () => s,
    subscribe(fn: Listener) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    canGo: (next: Phase) => NEXT[s.phase].includes(next),
    /** Переход фазы; недопустимый переход игнорируется и возвращает false. */
    phase(next: Phase): boolean {
      if (!NEXT[s.phase].includes(next)) return false;
      commit({ ...s, phase: next });
      return true;
    },
    /** Подъём на следующий этаж — только из фазы exit. */
    nextFloor(): boolean {
      if (s.phase !== 'exit') return false;
      commit({ ...s, floor: s.floor + 1, phase: 'enter' });
      return true;
    },
    seeScene(id: string) {
      if (!s.seenScenes.includes(id)) commit({ ...s, seenScenes: [...s.seenScenes, id] });
    },
    /** Новый круг или сброс: этаж 0, сцены круга забыты. */
    restart(lap: Lap) {
      commit({ floor: 0, phase: 'enter', lap, seenScenes: [] });
    },
  };
}

export type Store = ReturnType<typeof createStore>;
