import { describe, expect, it } from 'vitest';
import { available, pickScene, sceneDuration } from '../src/scenes/pick';
import { mulberry32 } from '../src/rng';
import type { Scene } from '../src/data';

const order = ['f0', 'p1', 'f1', 'f2', 'f3', 'f4', 'f5'];
const sc = (s: Partial<Scene> & { id: string }): Scene => ({ title: s.id, where: order, laps: [1, 2], steps: [], ...s });
const scenes: Scene[] = [
  sc({ id: 'S1', where: ['f1', 'f2'] }),
  sc({ id: 'S1-echo', laps: [2], pairOf: 'S1', crossLap: true, where: ['f1', 'f2'] }),
  sc({ id: 'S2', where: ['f2'] }),
  sc({ id: 'S2-echo', pairOf: 'S2', where: ['f3', 'f4'] }),
  sc({ id: 'S5' }),
  sc({ id: 'S5-echo', pairOf: 'S5', soon: true }),
  sc({ id: 'S11', after: 'f4', where: ['f3', 'f5'] }),
];
const base = { scenes, order, lap: 1, shownAt: {}, seenEver: [] as string[] };
const ids = (s: Scene[]) => s.map((x) => x.id);
const always = () => 0;
const never = () => 0.99;

describe('сайд-сцены', () => {
  it('только в своих местах', () => {
    expect(ids(available({ ...base, place: 'f0' }))).toEqual(['S5']);
    expect(ids(available({ ...base, place: 'f2' }))).toEqual(['S1', 'S2', 'S5']);
  });

  it('вторая часть пары — только после первой', () => {
    expect(ids(available({ ...base, place: 'f3' }))).not.toContain('S2-echo');
    expect(ids(available({ ...base, place: 'f3', shownAt: { S2: 'f2' } }))).toContain('S2-echo');
  });

  it('каждая сцена — один раз за круг', () => {
    expect(ids(available({ ...base, place: 'f2', shownAt: { S1: 'f1' } }))).not.toContain('S1');
  });

  it('отзвук через круг: на втором круге, если первая часть была когда-то', () => {
    expect(ids(available({ ...base, lap: 2, place: 'f1' }))).not.toContain('S1-echo');
    expect(ids(available({ ...base, lap: 2, place: 'f1', seenEver: ['S1'] }))).toContain('S1-echo');
    expect(ids(available({ ...base, lap: 1, place: 'f1', seenEver: ['S1'] }))).not.toContain('S1-echo');
  });

  it('«soon» приходит строго на следующей остановке и без жребия', () => {
    const next = { ...base, place: 'f2', shownAt: { S5: 'f1' }, floorHadScene: false, rng: never };
    expect(pickScene(next)?.id).toBe('S5-echo');
    expect(ids(available({ ...base, place: 'f3', shownAt: { S5: 'f1' } }))).not.toContain('S5-echo');
  });

  it('«after» — только выше указанного места', () => {
    expect(ids(available({ ...base, place: 'f3' }))).not.toContain('S11');
    expect(ids(available({ ...base, place: 'f5' }))).toContain('S11');
  });

  it('не больше одной на место и шанс 0.4', () => {
    expect(pickScene({ ...base, place: 'f2', floorHadScene: true, rng: always })).toBeNull();
    expect(pickScene({ ...base, place: 'f2', floorHadScene: false, rng: never })).toBeNull();
    const rng = mulberry32(123);
    let hits = 0;
    for (let i = 0; i < 2000; i++) if (pickScene({ ...base, place: 'f2', floorHadScene: false, rng })) hits++;
    expect(hits / 2000).toBeGreaterThan(0.35);
    expect(hits / 2000).toBeLessThan(0.45);
  });

  it('случайный проход: сцены «passage» и сцены этажа прямо под ним', () => {
    const extra: Scene[] = [...scenes, sc({ id: 'S3', where: ['passage'] }), sc({ id: 'S7', where: ['f1'] })];
    const got = ids(available({ ...base, scenes: extra, place: 'p-jar', tags: ['passage', 'f1'], order: ['f0', 'f1', 'p-jar', 'f2'] }));
    expect(got).toContain('S3');
    expect(got).toContain('S7');
    expect(ids(available({ ...base, scenes: extra, place: 'f2' }))).not.toContain('S3');
  });

  it('время показа: 4000 + 400 × слов', () => {
    expect(sceneDuration(10)).toBe(8000);
  });
});
