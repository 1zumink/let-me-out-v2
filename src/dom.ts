type Attrs = Record<string, string | number | boolean | undefined>;

/** Маленький помощник для DOM: h('button.btn', { type: 'button' }, 'текст'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: `${K}${string}`,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name as K);
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
