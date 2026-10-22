type Attrs = Record<string, string | number | boolean | undefined>;
type TagOf<T extends string> = T extends `${infer N}.${string}` ? N : T;
type ElementOf<T extends string> = TagOf<T> extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[TagOf<T>] : HTMLElement;

/** Маленький помощник для DOM: h('button.btn', { type: 'button' }, 'текст'). */
export function h<T extends string>(
  tag: T,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined | false)[]
): ElementOf<T> {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name) as ElementOf<T>;
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
