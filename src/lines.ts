// Реплики из текста: « … » внутри строки — пауза между облачками; «…» отдельной строкой — тишина.
import type { Line } from './data';

export interface Beat {
  who: string;
  text: string;
  pale?: boolean;
  small?: boolean;
  flash?: boolean;
  /** пауза без облачка */
  pause?: boolean;
}

export const PAUSE_MS = 1400;

export function beats(lines: Line[]): Beat[] {
  const out: Beat[] = [];
  for (const line of lines) {
    const l = typeof line === 'string' ? { text: line } : line;
    const base = { who: l.who ?? 'hero', pale: l.pale, small: l.small, flash: l.flash };
    if (l.text.trim() === '…') {
      out.push({ ...base, text: '', pause: true });
      continue;
    }
    // « … » с пробелами — пауза между облачками; «Ну…» и «…Ну вот» без пробела остаются частью реплики
    const t = l.text.trim();
    if (t.startsWith('… ')) out.push({ ...base, text: '', pause: true });
    const parts = t
      .replace(/^…\s+/, '')
      .replace(/\s+…$/, '')
      .split(/\s+…\s+/);
    parts.forEach((text, i) => {
      if (i > 0) out.push({ ...base, text: '', pause: true });
      out.push({ ...base, text });
    });
  }
  return out;
}

/** Момент места: второй круг подменяет первый, если у него есть такой ключ; остальное общее. */
export function pickMoment<T>(lines: { lap1: Record<string, unknown>; lap2?: Record<string, unknown> }, lap: 1 | 2, key: string): T | undefined {
  const own = lap === 2 ? (lines.lap2?.[key] as T | undefined) : undefined;
  return own ?? (lines.lap1[key] as T | undefined);
}
