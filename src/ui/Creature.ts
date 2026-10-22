// Живые существа (птица, улитка): inline SVG линией #e8e4dc, кипящая линия.
import { boilPath } from '../scene/boil';
import type { Rng } from '../rng';

const SVG_NS = 'http://www.w3.org/2000/svg';

const PATHS = {
  bird: [
    'M10 30 Q22 18 34 28 Q46 16 58 26',
    'M30 28 Q34 34 40 30',
  ],
  snail: [
    'M8 40 L52 40 Q58 40 58 34 L60 22 M56 34 L54 20',
    'M18 40 Q14 22 30 20 Q44 20 42 32 Q40 40 30 38 Q22 36 24 30 Q26 26 32 28',
  ],
} as const;

export type CreatureKind = keyof typeof PATHS;

export function Creature(kind: CreatureKind, { x, y, size = 64, rng, signal, label }: { x: number; y: number; size?: number; rng: Rng; signal?: AbortSignal; label?: string }) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 48');
  svg.setAttribute('class', `creature creature--${kind}`);
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else svg.setAttribute('aria-hidden', 'true');
  svg.style.left = `${x}%`;
  svg.style.top = `${y}%`;
  svg.style.width = `${size}px`;
  for (const d of PATHS[kind]) {
    const p = document.createElementNS(SVG_NS, 'path');
    boilPath(p, d, rng, 1.8, signal);
    svg.append(p);
  }
  return svg;
}
