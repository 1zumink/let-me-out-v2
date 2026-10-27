// «Убрать» (этаж 3, деревянная комната): клик/тап/Enter по вещи — она рассыпается, герой отвечает.
// Крылья за пальто и сам герой не убираются. «Оставить как есть» — другой путь, не проигрыш.
import { h } from '../dom';
import { focus, motion } from '../a11y';
import type { CollageItem, Line } from '../data';
import { memory } from '../memory';
import { between, type Rng } from '../rng';
import type { FloorCtx } from '../floors/types';
import { scope, type GameFactory } from './common';
import { textureUrl } from '../scene/textures';

const SHAKE_MS = 180;
const SHATTER_MS = 420;
const FADE_MS = 200;
const KEEP_NUDGE_MS = 30000;
const LAMP_DARK_MS = 1000;

type Pt = [number, number];

/** 8–12 клочков: сетка 3×3 с дрожащими узлами, часть ячеек режется по диагонали. */
export function shardPolygons(rng: Rng): Pt[][] {
  const n = 3;
  const grid: Pt[][] = [];
  for (let i = 0; i <= n; i++) {
    grid[i] = [];
    for (let j = 0; j <= n; j++) {
      const inner = (k: number) => k > 0 && k < n;
      grid[i][j] = [(i / n) * 100 + (inner(i) ? between(rng, -9, 9) : 0), (j / n) * 100 + (inner(j) ? between(rng, -9, 9) : 0)];
    }
  }
  const out: Pt[][] = [];
  const splitsWanted = 1 + Math.floor(rng() * 3);
  let splits = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = grid[i][j], b = grid[i + 1][j], c = grid[i + 1][j + 1], d = grid[i][j + 1];
      if (splits < splitsWanted && rng() < 0.45) {
        splits++;
        out.push([a, b, c], [a, c, d]);
      } else out.push([a, b, c, d]);
    }
  }
  return out;
}

const clip = (poly: Pt[]) => `polygon(${poly.map(([x, y]) => `${x.toFixed(1)}% ${y.toFixed(1)}%`).join(', ')})`;

export interface RoomNode {
  item: CollageItem;
  wrap: HTMLElement;
  btn: HTMLElement;
  spot: HTMLElement;
}

/** Комната: задник, стол, вещи-кнопки и спрятанные за пальто крылья. Убранные — сразу светлыми пятнами. */
export function buildRoom(ctx: FloorCtx, removed: string[], interactive: boolean) {
  const base = import.meta.env.BASE_URL;
  const params = ctx.data.params as { table: CollageItem; wings: CollageItem; backdrop?: CollageItem };
  const room = h('div.room');
  // на узком экране вещи разложены иначе, чтобы зоны нажатия 44 px не перекрывались;
  // телефон повернули — вещи перекладываются по новой раскладке
  const narrowMq = window.matchMedia('(max-width: 560px) and (orientation: portrait)');
  const placed: [HTMLElement, Pick<CollageItem, 'x' | 'y' | 'w' | 'xs' | 'on'>][] = [];
  const put = (el: HTMLElement, it: Pick<CollageItem, 'x' | 'y' | 'w' | 'xs' | 'on'>) => {
    const at = narrowMq.matches && it.xs ? it.xs : it;
    el.style.left = `${at.x}%`;
    // на столе: x — в процентах ширины стола, низ вещи — на столешнице
    if (it.on !== 'table') el.style.top = `${at.y}%`;
    el.style.setProperty('--w', String(at.w));
  };
  const place = (el: HTMLElement, it: Pick<CollageItem, 'x' | 'y' | 'w' | 'rot' | 'xs' | 'on'>) => {
    placed.push([el, it]);
    put(el, it);
    el.style.setProperty('--rot', `${it.rot ?? between(ctx.rng, -3, 3).toFixed(1)}deg`);
  };
  narrowMq.addEventListener('change', () => placed.forEach(([el, it]) => put(el, it)), { signal: ctx.signal });
  const img = (src: string) =>
    h('img.room-item__img', { src: base + src, alt: '', draggable: 'false', loading: 'lazy', decoding: 'async' });

  const backdrop = h('div.room-backdrop', { 'aria-hidden': 'true' });
  // доски комнаты — фото-фактура, если она уже есть; иначе нарисованные полосы
  const planks = textureUrl('planks');
  if (planks) backdrop.style.backgroundImage = `url("${planks}")`;
  room.append(backdrop);

  // стол — не вещь для уборки, но на нём стоят чашка и лампа (on: "table"): их место считается от столешницы,
  // поэтому при любом соотношении сторон экрана они стоят на столе, а не рядом
  const tableImg = img(params.table.src);
  tableImg.setAttribute('aria-hidden', 'true');
  const table = h('div.room-item.room-item--static', {}, tableImg);
  place(table, params.table);
  room.append(table);

  const wings = h('div.room-item.room-item--wings', { hidden: true });
  const wingsBtn = h('button.room-item__btn', { type: 'button', 'aria-label': ctx.ui.wingsLabel, tabindex: interactive ? undefined : '-1' }, img(params.wings.src));
  wings.append(wingsBtn);
  place(wings, params.wings);

  const nodes = new Map<string, RoomNode>();
  for (const item of ctx.data.collage ?? []) {
    const picture = img(item.src);
    const btn = h('button.room-item__btn', { type: 'button', 'aria-label': `${item.label} — ${ctx.ui.remove}` }, picture);
    if (!interactive) {
      btn.setAttribute('tabindex', '-1');
      btn.setAttribute('aria-hidden', 'true');
    }
    const spot = h('div.room-item__spot', { hidden: true, 'aria-hidden': 'true' });
    spot.style.maskImage = spot.style.webkitMaskImage = `url("${base + item.src}")`;
    const wrap = h('div.room-item', {}, spot, btn);
    wrap.classList.toggle('room-item--flat', !!item.flat);
    // обёртка держит пропорции картинки, чтобы пятно осталось, когда кнопка исчезнет
    picture.addEventListener('load', () => (wrap.style.aspectRatio = `${picture.naturalWidth} / ${picture.naturalHeight}`), { once: true });
    wrap.classList.toggle('room-item--on-table', item.on === 'table');
    place(wrap, item);
    if (removed.includes(item.id)) {
      btn.hidden = true;
      spot.hidden = false;
    }
    nodes.set(item.id, { item, wrap, btn, spot });
    (item.on === 'table' ? table : room).append(wrap);
  }
  room.append(wings);
  // пальто убрали раньше — крылья уже на крюке
  if (removed.includes('coat')) wings.hidden = false;
  return { room, nodes, wings, wingsBtn };
}

export const createRemove: GameFactory = (ctx, onDone) => {
  const s = scope(ctx);
  const { ui, hero } = ctx;
  const items = ctx.get<Record<string, string>>('items') ?? {};
  const removed: string[] = [];
  let finished = false;
  const hint = ctx.hint();
  const { room, nodes, wings, wingsBtn } = buildRoom(ctx, [], true);
  ctx.el.append(room);
  const keep = s.own(h('button.btn', { type: 'button' }, ui.keep));
  const heroGrip = s.own(h('div.grip.grip--body', { role: 'button', tabindex: '0', 'aria-label': ui.heroLabel }));

  // реплики не копятся: пока герой говорит, ждёт только последняя
  let pending: Line[] | null = null;
  let speaking = false;
  const speak = async (lines: Line[]) => {
    pending = lines;
    if (speaking) return;
    speaking = true;
    while (pending && !s.signal.aborted) {
      const next = pending;
      pending = null;
      await ctx.say(next);
    }
    speaking = false;
  };

  let nudge = 0;
  const poke = () => {
    hint.poke();
    keep.classList.remove('is-nudge');
    s.clear(nudge);
    nudge = s.after(KEEP_NUDGE_MS, () => keep.classList.add('is-nudge'));
  };

  const remaining = () => [...nodes.values()].filter((n) => !removed.includes(n.item.id));

  function shatter(wrap: HTMLElement, src: string) {
    for (const poly of shardPolygons(ctx.rng)) {
      const cx = poly.reduce((acc, p) => acc + p[0], 0) / poly.length - 50;
      const cy = poly.reduce((acc, p) => acc + p[1], 0) / poly.length - 50;
      const piece = h('div.shard', { 'aria-hidden': 'true' }, h('img', { src, alt: '' }));
      piece.style.clipPath = clip(poly);
      wrap.append(piece);
      piece
        .animate(
          [
            { transform: 'translate(0,0) rotate(0)', opacity: 1 },
            {
              transform: `translate(${cx * 0.9 + between(ctx.rng, -12, 12)}%, ${cy * 0.6 + between(ctx.rng, 20, 60)}%) rotate(${between(ctx.rng, -40, 40)}deg)`,
              opacity: 0,
            },
          ],
          { duration: SHATTER_MS, delay: between(ctx.rng, 0, 60), easing: 'cubic-bezier(.3,.6,.6,1)', fill: 'forwards' },
        )
        .finished.then(() => piece.remove(), () => piece.remove());
    }
  }

  function vanish(node: RoomNode, then: () => void) {
    const { wrap, btn, spot } = node;
    const done = () => {
      btn.hidden = true;
      btn.style.visibility = '';
      btn.classList.remove('is-shaking', 'is-bare');
      spot.hidden = false;
      then();
    };
    if (motion.reduced()) {
      // reduced motion: вещь исчезает сразу, без рассыпания
      btn.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS }).finished.then(done, done);
      return;
    }
    // подрагивает → теряет обводку → рассыпается на клочки; всё вместе ~600 мс
    btn.classList.add('is-shaking');
    s.after(SHAKE_MS, () => {
      btn.classList.add('is-bare');
      btn.style.visibility = 'hidden';
      shatter(wrap, btn.querySelector('img')!.src);
      s.after(SHATTER_MS, done);
    });
  }

  function take(node: RoomNode) {
    const id = node.item.id;
    if (finished || removed.includes(id)) return;
    poke();
    removed.push(id);
    const next = remaining()[0];
    if (document.activeElement === node.btn) focus(next?.btn ?? keep);
    const line = items[id];
    vanish(node, () => {
      if (id === 'coat') wings.hidden = false;
      if (id === 'lamp') {
        // темно; через секунду глаза привыкают — комнату видно в свете сверху
        ctx.light(50, 50, 4, true);
        s.after(LAMP_DARK_MS, () => {
          ctx.light(50, 12, 70);
          if (line) speak([line]);
        });
      } else if (line) speak([line]);
      if (!remaining().length) empty();
    });
  }

  async function empty() {
    finished = true;
    hint.stop();
    keep.remove();
    memory.set({ roomRemoved: [...removed] });
    while (speaking) await ctx.wait(200);
    await ctx.say(ctx.lines('empty'));
    if (!s.signal.aborted) onDone();
  }

  async function leaveAsIs() {
    if (finished) return;
    finished = true;
    hint.stop();
    keep.remove();
    memory.set({ roomRemoved: [...removed] });
    await ctx.say(ctx.lines('keep'));
    // крылья сами высовываются из-под пальто
    wings.hidden = false;
    wings.classList.add('is-peeking');
    await ctx.say(ctx.lines('keepWings'));
    if (!s.signal.aborted) onDone();
  }

  return {
    start() {
      poke();
      ctx.controls.append(keep);
      for (const node of nodes.values()) node.btn.addEventListener('click', () => take(node), { signal: s.signal });
      keep.addEventListener('click', leaveAsIs, { signal: s.signal });
      // крылья не убираются
      wingsBtn.addEventListener(
        'click',
        () => {
          poke();
          wingsBtn.classList.remove('is-shaking');
          void wingsBtn.offsetWidth;
          wingsBtn.classList.add('is-shaking');
          if (items.wings) speak([items.wings]);
        },
        { signal: s.signal },
      );
      // и герой тоже: мигает, но не исчезает
      hero.attach(heroGrip);
      const blink = () => {
        poke();
        hero.el.classList.remove('is-blink');
        void hero.el.offsetWidth;
        hero.el.classList.add('is-blink');
        if (items.hero) speak([items.hero]);
      };
      heroGrip.addEventListener('click', blink, { signal: s.signal });
      heroGrip.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), blink()), { signal: s.signal });
      focus(nodes.values().next().value?.btn);
    },
    stop() {
      hint.stop();
      hero.el.classList.remove('is-blink');
      // комната остаётся стоять, какой её оставили, до подъёма; но больше не отвечает
      room.inert = true;
      s.dispose();
    },
  };
};
