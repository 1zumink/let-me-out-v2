// Проход между этажами: пока читатель листает вверх, мимо проплывают вещи в нишах — по реплике на каждую.
import { h } from '../dom';
import { focus } from '../a11y';
import { silhouette, type SilhouetteOptions } from '../scene/silhouette';
import type { Floor, FloorCtx } from './types';

const SHIFT = 7; // % — на столько уезжают ниши за одно «листай»

export function passage(opts: { world?: SilhouetteOptions; decorate?: (ctx: FloorCtx) => void } = {}): Floor {
  let ctx: FloorCtx;
  const items: HTMLElement[] = [];
  const shelf = h('div.passage');
  return {
    mount(c) {
      ctx = c;
      c.el.append(silhouette(c.rng, opts.world ?? { wall: 14, ledges: [{ x0: 30, x1: 70, y: 84, depth: 10 }] }));
      opts.decorate?.(c);
      const base = import.meta.env.BASE_URL;
      for (const it of c.data.collage ?? []) {
        const img = h('img.cutout.passage__item', { src: base + it.src, alt: it.alt ?? it.label, loading: 'lazy', decoding: 'async', hidden: true });
        img.style.left = `${it.x}%`;
        img.style.top = `${it.y}%`;
        img.style.width = `calc(${it.w} * 1vmin)`;
        img.style.setProperty('--rot', `${((c.rng() - 0.5) * 6).toFixed(1)}deg`);
        items.push(img);
        shelf.append(img);
      }
      c.el.append(shelf);
    },
    arrive() {
      ctx.hero.reset();
      ctx.hero.place(50, 84);
      ctx.hero.set('idle');
      ctx.light(50, 60);
    },
    async start() {
      const lines = ctx.get<Record<string, string>>('items') ?? {};
      const ids = (ctx.data.collage ?? []).map((it) => it.id);
      const next = ctx.controls.appendChild(h('button.btn.btn--up', { type: 'button' }, ctx.ui.up));
      next.hidden = true;
      for (let i = 0; i < items.length; i++) {
        if (i > 0) {
          // ждём «листай вверх»: кнопка, стрелка, колесо или свайп
          next.hidden = false;
          focus(next);
          await new Promise<void>((resolve) => {
            next.onclick = () => resolve();
            ctx.on('up', resolve);
          });
          if (ctx.signal.aborted) return;
          next.hidden = true;
          ctx.hero.set('climb');
          shelf.style.setProperty('--shift', `${i * SHIFT}%`);
          await ctx.wait(700);
          ctx.hero.set('idle');
        }
        const it = items[i];
        it.hidden = false;
        ctx.light(parseFloat(it.style.left), parseFloat(it.style.top) + i * SHIFT, 30);
        await ctx.say(lines[ids[i]] ? [lines[ids[i]]] : []);
        if (ctx.signal.aborted) return;
      }
      next.remove();
      await ctx.say(ctx.lines('outro'));
      ctx.done();
    },
    stop() {},
    unmount() {
      ctx.el.replaceChildren();
    },
  };
}
