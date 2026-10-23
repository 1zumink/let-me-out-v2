// Живые существа (птица, улитка): inline SVG линией #e8e4dc, кипящая линия.
import { boilPath } from '../scene/boil';
import type { Rng } from '../rng';

const SVG_NS = 'http://www.w3.org/2000/svg';

const VIEWBOX: Record<string, string> = { kostya: '0 0 64 80' };

const PATHS = {
  // Костя: скелет в шарфе, сидит в нише, поворачивает голову к герою
  kostya: [
    'M22 8 Q34 2 42 12 Q46 22 38 28 L28 28 Q18 22 22 8 Z',
    'M26 15 Q28 13 30 15 Q28 18 26 15 M34 15 Q36 13 38 15 Q36 18 34 15',
    'M28 24 L36 24 M29 24 L29 27 M32 24 L32 27 M35 24 L35 27',
    'M32 30 L32 56',
    'M24 36 Q32 33 40 36 M25 41 Q32 38 39 41 M26 46 Q32 43 38 46',
    'M24 34 L18 46 L22 56 M40 34 L46 46 L42 56',
    'M28 56 L18 60 L20 74 M36 56 L46 60 L44 74',
    'M22 30 Q32 35 42 30 L40 34 Q32 38 24 34 Z M38 33 L44 44 L40 45 L36 35',
  ],
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
  svg.setAttribute('viewBox', VIEWBOX[kind] ?? '0 0 64 48');
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
