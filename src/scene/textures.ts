// Фото-фактуры стен: только те, что реально лежат в src/assets/textures (их кладёт npm run collage:normalize).
import type { SilhouetteOptions } from './silhouette';

const files = import.meta.glob<string>('../assets/textures/*.webp', { eager: true, query: '?url', import: 'default' });
const byId = new Map(Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url]));

export const textureUrl = (id: string | undefined) => (id ? byId.get(id) : undefined);

/**
 * Силуэт мира поверх затемнённой фактуры: фактура видна только в очертаниях стен и уступов.
 * Без файла фактуры — просто силуэт, как раньше.
 */
export function texturedWalls(svg: SVGSVGElement, id: string | undefined): HTMLElement | null {
  const url = textureUrl(id);
  if (!url) return null;
  // тонкие выступы остаются чистым силуэтом: фактура на полоске в пару процентов читается как шум
  const shape = svg.cloneNode(true) as SVGSVGElement;
  shape.querySelectorAll('polygon').forEach((p) => {
    const ys = (p.getAttribute('points') ?? '').split(/\s+/).map((pt) => Number(pt.split(',')[1]));
    if (Math.max(...ys) - Math.min(...ys) < 4) p.remove();
  });
  shape.querySelector('.glass')?.remove();
  const mask = `url("data:image/svg+xml;utf8,${encodeURIComponent(shape.outerHTML.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'))}")`;
  const el = document.createElement('div');
  el.className = 'walls-texture';
  el.setAttribute('aria-hidden', 'true');
  el.style.backgroundImage = `url("${url}")`;
  el.style.maskImage = el.style.webkitMaskImage = mask;
  return el;
}

export type { SilhouetteOptions };
