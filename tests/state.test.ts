import { describe, expect, it } from 'vitest';
import { createStore } from '../src/state';

describe('state machine', () => {
  it('идёт enter → play → stop → exit → enter следующего этажа', () => {
    const s = createStore();
    expect(s.phase('play')).toBe(true);
    expect(s.phase('stop')).toBe(true);
    expect(s.phase('exit')).toBe(true);
    expect(s.nextFloor()).toBe(true);
    expect(s.get()).toMatchObject({ floor: 1, phase: 'enter' });
  });

  it('запрещает прыжки через фазы', () => {
    const s = createStore();
    expect(s.phase('exit')).toBe(false);
    expect(s.nextFloor()).toBe(false);
    s.phase('play');
    expect(s.phase('enter')).toBe(false);
    expect(s.get().phase).toBe('play');
  });

  it('этаж без игры: enter → stop', () => {
    const s = createStore();
    expect(s.phase('stop')).toBe(true);
  });

  it('restart сбрасывает этаж и увиденные сцены', () => {
    const s = createStore({ floor: 5, phase: 'stop' });
    s.seeScene('S1');
    s.seeScene('S1');
    expect(s.get().seenScenes).toEqual(['S1']);
    s.restart(2);
    expect(s.get()).toEqual({ floor: 0, phase: 'enter', lap: 2, seenScenes: [] });
  });

  it('оповещает подписчиков с прошлым состоянием', () => {
    const s = createStore();
    const log: string[] = [];
    s.subscribe((now, prev) => log.push(`${prev.phase}→${now.phase}`));
    s.phase('play');
    expect(log).toEqual(['enter→play']);
  });
});
