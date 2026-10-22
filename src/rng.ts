export type Rng = () => number;

// mulberry32: маленький и воспроизводимый генератор, чтобы баги повторялись по ?seed=
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromUrl(search: string): number {
  const raw = new URLSearchParams(search).get('seed');
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? n >>> 0 : (Math.random() * 2 ** 32) >>> 0;
}

export const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
