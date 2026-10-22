// localStorage может быть недоступен (приватный режим, запрет cookies) — тогда живём в памяти.
const memory = new Map<string, string>();

export const storage = {
  get(key: string): string | null {
    try {
      const v = localStorage.getItem(key);
      if (v !== null) return v;
    } catch {
      /* память ниже */
    }
    return memory.get(key) ?? null;
  },
  set(key: string, value: string) {
    memory.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* остаёмся в памяти */
    }
  },
  remove(key: string) {
    memory.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      /* остаёмся в памяти */
    }
  },
};

export const LAP_KEY = 'lmo.lap';
