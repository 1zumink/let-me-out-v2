// Проход между этажами: пока читатель листает вверх, мимо проплывают вещи в нишах — по реплике на каждую.
// Полка едет за прокруткой, герой лезет по стене напротив вещей; в покое держится за стену.
import { h } from '../dom';
import { focus, motion } from '../a11y';
import { createScrub, type Scrub } from '../scrub';
import { silhouette, type SilhouetteOptions } from '../scene/silhouette';
import { texturedWalls } from '../scene/textures';
import { wallX } from '../climbPath';
import { groundOf } from './gameFloor';
import type { Floor, FloorCtx, Ground, Pose } from './types';

const SHIFT = 7; // % — на столько уезжают ниши за одно «листай»
const Y = 46; // руки на стене

export function passage(opts: { world?: SilhouetteOptions; decorate?: (ctx: FloorCtx) => void } = {}): Floor {
  let ctx: FloorCtx;
  const items: HTMLElement[] = [];
  const shelf = h('div.passage');
  let scrub: Scrub | null = null;
  const world = opts.world ?? { wall: 14 };
  // лезет по стене напротив вещей, чтобы не закрывать их
  const ground = (): Ground => groundOf(world, { side: (ctx?.data.collage?.[0]?.x ?? 72) < 50 ? 'right' : 'left' });
  const entry = (): Pose => ({ x: wallX(ground().walls, ground().side!, ctx.hero.box()), y: Y, anchor: 'hands', state: 'wall' });
  const hold = () => ctx.hero.scrub('wall', 0);

  return {
    entry,
    ground,
    mount(c) {
      ctx = c;
      const walls = silhouette(c.rng, world);
      c.el.append(walls);
      opts.decorate?.(c);
      const tex = texturedWalls(walls, (c.data.params as { texture?: string } | undefined)?.texture);
      if (tex) walls.after(tex);
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
      const e = entry();
      ctx.hero.reset();
      ctx.hero.put(e.x, e.y, e.anchor);
      ctx.hero.flip(ground().side === 'left');
      hold();
      ctx.light(50, 50);
    },
    async start() {
      const lines = ctx.get<Record<string, string>>('items') ?? {};
      const ids = (ctx.data.collage ?? []).map((it) => it.id);
      const next = ctx.controls.appendChild(h('button.btn.btn--up', { type: 'button' }, ctx.ui.up));
      next.hidden = true;
      next.addEventListener('click', () => scrub?.play());
      ctx.on('up', () => scrub?.play());
      ctx.onScroll((delta, ended) => {
        if (!scrub) return;
        if (ended) scrub.release();
        else if (delta > 0 || scrub.progress > 0) scrub.drive(delta);
      });

      for (let i = 0; i < items.length; i++) {
        if (i > 0) {
          // ждём «листай вверх»: полка и герой идут за прокруткой, кнопка и стрелка — тот же путь
          next.hidden = false;
          focus(next);
          await new Promise<void>((resolve) => {
            const from = (i - 1) * SHIFT;
            scrub = createScrub({
              distance: () => ctx.el.clientHeight * 0.6,
              instant: motion.reduced,
              onProgress: (p) => {
                shelf.style.setProperty('--shift', `${from + p * SHIFT}%`);
                // кадр перехвата — по пройденному пути: встала прокрутка — встали руки
                ctx.hero.scrub('wall', (p * 1.5) % 1);
              },
              onCancel: hold,
              onDone: resolve,
            });
          });
          scrub = null;
          if (ctx.signal.aborted) return;
          next.hidden = true;
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
      scrub?.reset();
      ctx.el.replaceChildren();
    },
  };
}
