import { describe, expect, it } from 'vitest';
import { pickMoment, beats } from '../src/lines';
import floors from '../data/floors.json';
import type { Line, Place } from '../src/data';

const places = floors as unknown as Place[];
const place = (id: string) => places.find((p) => p.id === id)!;
const text = (lines: Line[] | undefined) => beats(lines ?? []).filter((b) => !b.pause).map((b) => b.text);

describe('второй круг', () => {
  it('подменяет вступления, где они есть', () => {
    expect(text(pickMoment(place('f0').lines, 2, 'enter'))[0]).toBe('Я знаю, ты хотел помочь.');
    expect(text(pickMoment(place('f1').lines, 2, 'enter'))[0]).toBe('Тут я в прошлый раз съехал. Подержи чуть дольше, ладно?');
    expect(text(pickMoment(place('f8').lines, 2, 'sequence'))[0]).toBe('Я знаю, чем это кончается. Всё равно спасибо, что дотащил.');
  });

  it('остальное — общее с первым кругом', () => {
    expect(pickMoment(place('f1').lines, 2, 'stops')).toEqual(pickMoment(place('f1').lines, 1, 'stops'));
    expect(pickMoment(place('f8').lines, 2, 'hold20')).toEqual(pickMoment(place('f8').lines, 1, 'hold20'));
  });

  it('у каждого ключа второго круга, который читает код, есть реплики', () => {
    const used: Record<string, string[]> = {
      f0: ['enter', 'silenceMs'],
      f1: ['enter'],
      f2: ['enter'],
      f3: ['emptyRoom', 'fullRoom'],
      f4: ['enter'],
      f5: ['enterRemoved', 'enterFolded'],
      f6: ['enter'],
      f8: ['sequence'],
    };
    for (const [id, keys] of Object.entries(used))
      for (const key of keys) expect(place(id).lines.lap2?.[key], `${id}.lap2.${key}`).toBeTruthy();
  });

  it('на первом круге реплики второго не видны', () => {
    expect(pickMoment(place('f3').lines, 1, 'emptyRoom')).toBeUndefined();
  });
});
