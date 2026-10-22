import { describe, expect, it } from 'vitest';
import { available, pickScene, sceneDuration } from '../src/scenes/pick';
import { mulberry32 } from '../src/rng';
import type { Scene } from '../src/data';

const scenes: Scene[] = [
  { id: 'S1', text: 'a', laps: [1, 2] },
  { id: 'S2', text: 'b', laps: [1, 2], pairOf: 'S1' },
  { id: 'S3', text: 'c', laps: [2] },
];
const always = () => 0; // rng: шанс всегда срабатывает, берём первый кандидат
const never = () => 0.99;

describe('сайд-сцены', () => {
  it('вторая часть пары — только после первой', () => {
    expect(available({ scenes, lap: 1, seen: [] }).map((s) => s.id)).toEqual(['S1']);
    expect(available({ scenes, lap: 1, seen: ['S1'] }).map((s) => s.id)).toEqual(['S2']);
  });

  it('каждая сцена — один раз за круг', () => {
    expect(available({ scenes, lap: 1, seen: ['S1', 'S2'] })).toEqual([]);
  });

  it('часть сцен открывается только на втором круге', () => {
    expect(available({ scenes, lap: 2, seen: ['S1', 'S2'] }).map((s) => s.id)).toEqual(['S3']);
  });

  it('не больше одной на этаж', () => {
    expect(pickScene({ scenes, lap: 1, seen: [], floorHadScene: true, rng: always })).toBeNull();
  });

  it('шанс 0.4', () => {
    expect(pickScene({ scenes, lap: 1, seen: [], floorHadScene: false, rng: never })).toBeNull();
    expect(pickScene({ scenes, lap: 1, seen: [], floorHadScene: false, rng: always })?.id).toBe('S1');
    const rng = mulberry32(123);
    let hits = 0;
    for (let i = 0; i < 2000; i++) if (pickScene({ scenes, lap: 1, seen: [], floorHadScene: false, rng })) hits++;
    expect(hits / 2000).toBeGreaterThan(0.35);
    expect(hits / 2000).toBeLessThan(0.45);
  });

  it('одинаковый сид — одинаковый выбор', () => {
    const run = () => {
      const rng = mulberry32(7);
      return Array.from({ length: 10 }, () => pickScene({ scenes, lap: 2, seen: [], floorHadScene: false, rng })?.id ?? '-').join();
    };
    expect(run()).toBe(run());
  });

  it('время показа: 4000 + 400 × слов', () => {
    expect(sceneDuration(10)).toBe(8000);
  });
});
