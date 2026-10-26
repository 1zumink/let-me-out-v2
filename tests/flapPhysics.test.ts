import { describe, expect, it } from 'vitest';
import { createFlight, flap, step, LEDGES, type Flight, type Side } from '../src/games/flapPhysics';

const FRAME = 16;

/** Взмахи каждые every мс, крыло — sides(i); ms мс полёта. */
function fly(f: Flight, every: number, sides: (i: number) => Side, ms: number) {
  let next = 0;
  let i = 0;
  const alts: number[] = [];
  for (let t = 0; t < ms; t += FRAME) {
    if (t >= next) {
      flap(f, sides(i++));
      next += every;
    }
    step(f, FRAME);
    alts.push(f.alt);
  }
  return alts;
}
const alternate = (i: number): Side => (i % 2 ? 'right' : 'left');

describe('flapPhysics', () => {
  it('поочерёдно ~3 раза в секунду — стабильно поднимает', () => {
    const f = createFlight(50, 0);
    const alts = fly(f, 333, alternate, 3000);
    // каждую секунду заметно выше прежнего
    const perSec = [alts[62], alts[124], alts[186]];
    expect(perSec[0]).toBeGreaterThan(0.12);
    expect(perSec[1] - perSec[0]).toBeGreaterThan(0.12);
    expect(perSec[2] - perSec[1]).toBeGreaterThan(0.12);
    // и почти не уводит вбок
    expect(Math.abs(f.x - 50)).toBeLessThan(4);
  });

  it('мешанина каждые 80 мс поднимает заметно хуже ритма', () => {
    const rhythm = createFlight(50, 0);
    const mash = createFlight(50, 0);
    fly(rhythm, 333, alternate, 3000);
    fly(mash, 80, alternate, 3000);
    expect(mash.alt).toBeLessThan(rhythm.alt / 3);
    const chaos = createFlight(50, 0);
    fly(chaos, 80, (i) => ((i * 7919) % 5 < 2 ? 'left' : 'right'), 3000);
    expect(chaos.alt).toBeLessThan(rhythm.alt / 3);
  });

  it('ранний взмах слабее, но не нулевой', () => {
    const f = createFlight(50, 0);
    expect(flap(f, 'left')).toBe(1);
    step(f, 175);
    const weak = flap(f, 'right');
    expect(weak).toBeGreaterThan(0);
    expect(weak).toBeLessThan(0.5);
  });

  it('одно крыло подряд уводит вбок: левое — вправо, правое — влево', () => {
    const r = createFlight(50, 0);
    fly(r, 333, () => 'left', 2000);
    expect(r.x).toBeGreaterThan(60);
    const l = createFlight(50, 0);
    fly(l, 333, () => 'right', 2000);
    expect(l.x).toBeLessThan(40);
  });

  it('стены не выпускают из зала', () => {
    const f = createFlight(50, 0);
    fly(f, 333, () => 'left', 6000);
    expect(f.x).toBeLessThanOrEqual(78);
  });

  it('без ввода садится на ближайший выступ ниже', () => {
    const mid = createFlight(50, 0.9);
    for (let t = 0; t < 8000; t += FRAME) step(mid, FRAME);
    expect(mid.alt).toBe(LEDGES[1].alt);
    expect(mid.perch).toBe(1);

    // мимо выступа (x вне 40–60) — до пола
    const side = createFlight(35, 0.9);
    for (let t = 0; t < 12000; t += FRAME) step(side, FRAME);
    expect(side.alt).toBe(0);
    expect(side.perch).toBe(0);
  });

  it('снижение плавное, без рывков', () => {
    const f = createFlight(50, 0.9);
    let prev = f.alt;
    for (let t = 0; t < 3000; t += FRAME) {
      step(f, FRAME);
      expect(prev - f.alt).toBeLessThan(0.01);
      prev = f.alt;
    }
  });

  it('выступ односторонний: снизу пролетаешь', () => {
    const f = createFlight(50, 0);
    const alts = fly(f, 333, alternate, 6000);
    expect(Math.max(...alts)).toBe(1);
  });
});
