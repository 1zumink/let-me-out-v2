// «Убрать» (этаж 3, комната): клик/тап/Enter/пробел по вещи — она рассыпается на бумажные клочки.
import { h } from '../dom';
import { focus, motion } from '../a11y';
import type { CollageItem } from '../data';
import { between, type Rng } from '../rng';
import { scope, type GameFactory } from './common';

const SHAKE_MS = 180;
const SHATTER_MS = 420;
const FADE_MS = 200;

type Pt = [number, number];

/** 8–12 клочков: сетка 3×3 с дрожащими узлами, часть ячеек режется по диагонали. */
export function shardPolygons(rng: Rng): Pt[][] {
  const n = 3;
  const grid: Pt[][] = [];
  for (let i = 0; i <= n; i++) {
    grid[i] = [];
    for (let j = 0; j <= n; j++) {
      const inner = (k: number) => k > 0 && k < n;
      grid[i][j] = [
        (i / n) * 100 + (inner(i) ? between(rng, -9, 9) : 0),
        (j / n) * 100 + (inner(j) ? between(rng, -9, 9) : 0),
      ];
    }
  }
  const out: Pt[][] = [];
  const splitsWanted = 1 + Math.floor(rng() * 3); // 9 + (1..3) = 10–12 клочков
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

export const createRemove: GameFactory = (ctx, onDone) => {
  const s = scope(ctx);
  const { ui } = ctx;
  const base = import.meta.env.BASE_URL;
  const items = ctx.data.collage ?? [];
  const removed = new Set<string>();
  const nodes = new Map<string, { wrap: HTMLElement; btn: HTMLElement; spot: HTMLElement }>();
  let finished = false;
  const hint = ctx.hint();

  const room = s.own(h('div.room'));
  const restore = s.own(h('button.btn', { type: 'button' }, ui.restoreAll));

  const remaining = () => items.filter((it) => !removed.has(it.id));

  function build(item: CollageItem) {
    const src = base + item.src;
    const img = h('img.room-item__img', { src, alt: '', draggable: 'false', loading: 'lazy', decoding: 'async' });
    const btn = h('button.room-item__btn', { type: 'button', 'aria-label': `${item.label} — ${ui.remove}` }, img);
    const spot = h('div.room-item__spot', { hidden: true, 'aria-hidden': 'true' });
    spot.style.maskImage = spot.style.webkitMaskImage = `url("${src}")`;
    const wrap = h('div.room-item', {}, spot, btn);
    // обёртка держит пропорции картинки, чтобы пятно осталось, когда кнопка исчезнет
    img.addEventListener('load', () => (wrap.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`), { once: true });
    wrap.style.left = `${item.x}%`;
    wrap.style.top = `${item.y}%`;
    wrap.style.setProperty('--w', String(item.w));
    wrap.style.setProperty('--rot', `${item.rot ?? between(ctx.rng, -3, 3).toFixed(1)}deg`);
    btn.addEventListener('click', () => take(item), { signal: s.signal });
    nodes.set(item.id, { wrap, btn, spot });
    room.append(wrap);
  }

  function shatter(wrap: HTMLElement, src: string) {
    const polys = shardPolygons(ctx.rng);
    polys.forEach((poly) => {
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
    });
  }

  function take(item: CollageItem) {
    if (finished || removed.has(item.id)) return;
    hint.poke();
    removed.add(item.id);
    const { wrap, btn, spot } = nodes.get(item.id)!;
    const next = remaining()[0];
    const after = (fn: () => void, ms: number) => s.after(ms, fn);

    const vanish = () => {
      btn.hidden = true;
      btn.classList.remove('is-shaking', 'is-bare');
      spot.hidden = false;
      if (document.activeElement === document.body || !document.activeElement || document.activeElement === btn)
        focus(next ? nodes.get(next.id)!.btn : restore);
    };

    if (motion.reduced()) {
      btn.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, fill: 'forwards' }).finished.then(() => {
        btn.getAnimations().forEach((a) => a.cancel());
        vanish();
        check();
      });
      return;
    }
    // подрагивает → теряет обводку → рассыпается; всё вместе ~600 мс
    btn.classList.add('is-shaking');
    after(() => {
      btn.classList.add('is-bare');
      btn.style.visibility = 'hidden';
      shatter(wrap, btn.querySelector('img')!.src);
      after(() => {
        btn.style.visibility = '';
        vanish();
        check();
      }, SHATTER_MS);
    }, SHAKE_MS);
    // фокус не должен потеряться на исчезающей кнопке
    if (document.activeElement === btn) focus(next ? nodes.get(next.id)!.btn : restore);
  }

  function check() {
    if (finished || remaining().length) return;
    finished = true;
    hint.stop();
    restore.remove();
    ctx.say(ctx.lines('empty')).then(() => !s.signal.aborted && onDone());
  }

  function restoreAll() {
    if (finished) return;
    hint.poke();
    removed.clear();
    nodes.forEach(({ btn, spot }) => {
      btn.hidden = false;
      btn.style.visibility = '';
      spot.hidden = true;
      if (!motion.reduced()) btn.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    });
  }

  // комната видна сразу, ещё до начала игры
  items.forEach(build);
  ctx.el.append(room);

  return {
    start() {
      hint.poke();
      ctx.controls.append(restore);
      restore.addEventListener('click', restoreAll, { signal: s.signal });
      const first = nodes.values().next().value;
      focus(first?.btn);
    },
    stop() {
      hint.stop();
      s.dispose();
    },
  };
};
