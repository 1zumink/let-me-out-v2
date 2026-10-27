import { describe, expect, it } from 'vitest';
import { climbPath, wallX, type Footing } from '../src/climbPath';

const box = { w: 20, h: 26 };
// этаж 1: уступ посередине, стены по 14 %; следующее — уступ 22…78 на высоте 70
const a: Footing = { walls: [14, 14], ledge: { x0: 30, x1: 70, y: 84 }, x: 40, y: 84, state: 'idle' };
const b: Footing = { walls: [12, 12], ledge: { x0: 22, x1: 78, y: 70 }, x: 50, y: 70, state: 'idle' };

const sample = (path: ReturnType<typeof climbPath>, n = 400) => Array.from({ length: n + 1 }, (_, i) => path.at(i / n));

describe('путь подъёма', () => {
  it('начинается в позе и кончается в позе следующего места', () => {
    const path = climbPath(a, b, box);
    const s = path.at(0);
    const e = path.at(1);
    expect(s.x).toBeCloseTo(a.x);
    expect(s.y).toBeCloseTo(a.y);
    expect(e.x).toBeCloseTo(b.x);
    expect(e.y).toBeCloseTo(b.y - 100);
    expect(e.v).toBe(1);
  });

  it('по уступу к стене, прыжок, стена, прыжок на уступ, шаг', () => {
    expect(climbPath(a, b, box).segments.map((s) => s.kind)).toEqual(['walk', 'jump', 'wall', 'jump', 'walk']);
  });

  it('вверх идёт только у стены: в середине шахты не висит', () => {
    const path = climbPath(a, b, box);
    const lx = wallX(a.walls, 'left', box);
    for (const pose of sample(path)) {
      if (pose.kind === 'wall') expect(pose.x).toBeLessThanOrEqual(lx + 0.01);
    }
  });

  it('без скачков: соседние позы рядом', () => {
    const path = climbPath(a, b, box);
    const poses = sample(path, 1000);
    for (let i = 1; i < poses.length; i++) {
      expect(Math.hypot(poses[i].x - poses[i - 1].x, poses[i].y - poses[i - 1].y)).toBeLessThan(1.5);
    }
  });

  it('камера не уходит назад, пока путь идёт вперёд', () => {
    const poses = sample(climbPath(a, b, box));
    for (let i = 1; i < poses.length; i++) expect(poses[i].v).toBeGreaterThanOrEqual(poses[i - 1].v - 1e-9);
  });

  it('уступ у самой стены — вылезает через край, а не прыгает', () => {
    const room: Footing = { walls: [6, 6], ledge: { x0: 4, x1: 96, y: 84 }, x: 24, y: 84, state: 'idle' };
    expect(climbPath(a, room, box).segments.map((s) => s.kind)).toEqual(['walk', 'jump', 'wall', 'mantle', 'walk']);
  });

  it('сторона — ближняя к герою', () => {
    expect(climbPath({ ...a, x: 60 }, b, box).side).toBe('right');
    expect(climbPath(a, b, box).side).toBe('left');
  });

  it('на стене смотрит в стену, в прыжке на уступ — к уступу', () => {
    const path = climbPath(a, b, box);
    const wall = path.segments.find((s) => s.kind === 'wall')!;
    expect(path.at((wall.p0 + wall.p1) / 2).left).toBe(true);
    const jump = path.segments.filter((s) => s.kind === 'jump')[1];
    expect(path.at((jump.p0 + jump.p1) / 2).left).toBe(false);
  });

  it('отпустил в прыжке — допрыгивает; на стене — остаётся', () => {
    const path = climbPath(a, b, box);
    const jump = path.segments.find((s) => s.kind === 'jump')!;
    const wall = path.segments.find((s) => s.kind === 'wall')!;
    expect(path.settle((jump.p0 + jump.p1) / 2)).toBe(jump.p1);
    const mid = (wall.p0 + wall.p1) / 2;
    expect(path.settle(mid)).toBe(mid);
  });

  it('под стеклом — по стене до потолка, потом перехватами', () => {
    const glass: Footing = { walls: [4, 4], x: 50, y: 40, state: 'hang', ceiling: true };
    const kinds = climbPath(a, glass, box).segments.map((s) => s.kind);
    expect(kinds.slice(-2)).toEqual(['wall', 'traverse']);
  });

  it('висящий на стене начинает сразу со стены', () => {
    const hang: Footing = { walls: [14, 14], x: wallX([14, 14], 'left', box), y: 46, state: 'hang' };
    expect(climbPath(hang, b, box).segments[0].kind).toBe('wall');
  });

  it('прыжок на стену играет ленту назад, прыжок на уступ — вперёд', () => {
    const path = climbPath(a, b, box);
    const [toWall, toLedge] = path.segments.filter((s) => s.kind === 'jump');
    const t = (s: typeof toWall, u: number) => path.at(s.p0 + (s.p1 - s.p0) * u).t;
    expect(t(toWall, 0.1)).toBeGreaterThan(t(toWall, 0.9));
    expect(t(toWall, 0.01)).toBeCloseTo(1, 1);
    expect(t(toLedge, 0.1)).toBeLessThan(t(toLedge, 0.9));
  });
});
