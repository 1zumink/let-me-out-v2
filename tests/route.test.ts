import { describe, expect, it } from 'vitest';
import floors from '../data/floors.json';
import passages from '../data/passages.json';
import { buildRoute, gaps, sceneTags, type PassagePool } from '../src/route';
import { mulberry32 } from '../src/rng';
import type { Place } from '../src/data';

const places = floors as unknown as Place[];
const pool = passages as PassagePool;
const route = (seed: number, seenItems: string[] = []) => buildRoute({ places, pool, rng: mulberry32(seed), seenItems });
const passagesOf = (r: Place[]) => r.filter((p) => p.module === 'passage');

describe('маршрут круга', () => {
  it('этажи и уступ на своих местах', () => {
    for (let seed = 1; seed < 50; seed++) {
      const ids = route(seed).filter((p) => p.module !== 'passage').map((p) => p.id);
      expect(ids).toEqual(['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'p-ledge', 'f6', 'f7', 'f8']);
    }
  });

  it('4–5 проходов, никогда два подряд и никогда рядом с уступом', () => {
    for (let seed = 1; seed < 200; seed++) {
      const r = route(seed);
      const n = passagesOf(r).length;
      expect(n).toBeGreaterThanOrEqual(4);
      expect(n).toBeLessThanOrEqual(5);
      r.forEach((p, i) => {
        if (p.kind !== 'passage') return;
        expect(r[i - 1]?.kind, `${seed}: ${r.map((x) => x.id).join()}`).toBe('floor');
        expect(r[i + 1]?.kind).toBe('floor');
      });
    }
  });

  it('промежутки: всё, кроме соседних с уступом', () => {
    expect(gaps(places).map((i) => `${places[i].id}-${places[i + 1].id}`)).toEqual(['f0-f1', 'f1-f2', 'f2-f3', 'f3-f4', 'f4-f5', 'f6-f7', 'f7-f8']);
  });

  it('в круге вещи не повторяются', () => {
    for (let seed = 1; seed < 100; seed++) {
      const ids = passagesOf(route(seed)).map((p) => p.collage![0].id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('один сид — один маршрут, разные сиды — разные', () => {
    const key = (r: Place[]) => r.map((p) => p.id).join();
    expect(key(route(7))).toBe(key(route(7)));
    const keys = new Set(Array.from({ length: 20 }, (_, i) => key(route(i + 1))));
    expect(keys.size).toBeGreaterThan(10);
  });

  it('на втором круге сначала невиданные вещи', () => {
    const first = passagesOf(route(3)).map((p) => p.collage![0].id);
    const second = passagesOf(route(4, first)).map((p) => p.collage![0].id);
    const unseen = pool.items.length - first.length;
    expect(second.filter((id) => !first.includes(id)).length).toBe(Math.min(unseen, second.length));
  });

  it('«Кто-то тут жил…» — только после первого прохода круга', () => {
    const ps = passagesOf(route(11));
    expect(ps[0].lines.lap1.outro).toEqual(pool.outro);
    ps.slice(1).forEach((p) => expect(p.lines.lap1.outro).toEqual([]));
  });

  it('фон по глубине: ниже этажа 2 — кольца, выше — земля', () => {
    for (let seed = 1; seed < 60; seed++) {
      for (const p of passagesOf(route(seed))) {
        const below = (p.params as { below: string }).below;
        expect((p.params as { texture: string }).texture).toBe(['f0', 'f1'].includes(below) ? 'rings' : 'earth');
      }
    }
  });

  it('теги для сцен: проход — «passage» и этаж под ним', () => {
    const p = passagesOf(route(5))[0];
    expect(sceneTags(p)).toEqual(['passage', (p.params as { below: string }).below]);
    expect(sceneTags(places[0])).toEqual(['f0']);
  });
});
