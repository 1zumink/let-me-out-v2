// «Отпусти» (этаж 8): герой долез до стекла экрана. Камера подъезжает к нему вплотную,
// он прижимает ладонь к стеклу — к нашему экрану — и говорит. После «А теперь отпусти» —
// клик или тап по нему (кнопка «отпустить» — то же с клавиатуры): пальцы соскальзывают.
// Первый круг — падение без крика и темнота; второй — герой садится на нижнюю кромку окна.
import { h } from '../dom';
import { focus, motion } from '../a11y';
import type { Line } from '../data';
import { scope, type GameFactory } from './common';

const LONG_MS = 20000;
const ZOOM = 3.6; // камера вплотную: герой почти по плечи, рука у стекла
const BASE = import.meta.env.BASE_URL;

const textOf = (l: Line) => (typeof l === 'string' ? l : l.text);

/** Ладонь с той стороны стекла: рисунок автора, если есть, иначе — та же линия, что у героя. */
function Palm() {
  const el = h('div.palm', { 'aria-hidden': 'true' });
  const img = h('img.palm__img', { src: `${BASE}assets/collage/palm.webp`, alt: '', decoding: 'async' });
  img.addEventListener('error', () => {
    img.remove();
    el.insertAdjacentHTML(
      'beforeend',
      `<svg class="palm__svg" viewBox="0 0 200 240"><path d="M62 228 C40 196 34 160 40 128 L36 72 C35 60 52 58 55 70 L62 118 L60 40 C59 26 78 25 80 39 L84 112 L88 26 C89 12 108 13 108 27 L106 112 L114 40 C116 27 134 29 132 43 L126 122 L144 96 C152 84 168 92 162 106 L136 170 C126 198 112 214 104 228"/><path class="palm__print" d="M66 150 q22 -8 46 0 M70 170 q20 -6 40 0 M78 190 q14 -4 28 0"/></svg>`,
    );
  });
  el.append(h('div.palm__fog'), img);
  return el;
}

export const createLetgo: GameFactory = (ctx, onDone) => {
  const s = scope(ctx);
  const { hero, ui } = ctx;
  const stage = () => ctx.el.closest<HTMLElement>('.stage');
  let ready = false; // «А теперь отпусти» уже сказано
  let released = false;
  let longTimer = 0;
  const hint = ctx.hint();

  // клик по герою: зона на его теле (у .hero нет событий указателя) и сама ладонь
  const target = s.own(h('div.grip.grip--letgo', { role: 'button', tabindex: '0', 'aria-label': ui.letgoTarget }));
  const button = s.own(h('button.btn', { type: 'button' }, ui.letgo));
  const palm = s.own(Palm());

  /** Камера подъезжает к герою: мир, герой и свет увеличиваются вокруг его груди у стекла. */
  let zoomed: Animation[] = [];
  let shift = '0px 0px';
  const closeup = (on: boolean) => {
    const st = stage();
    if (!st) return;
    const layers = ['.world', '.hero-layer', '.light'].map((q) => st.querySelector<HTMLElement>(q)!).filter(Boolean);
    if (on) {
      const r = hero.el.getBoundingClientRect();
      const box = layers[1].getBoundingClientRect();
      // наезд — на руку, которую он прижмёт к стеклу (в ленте palm она справа от головы), и рука уходит в центр кадра,
      // туда же, где вырастет ладонь (.palm: 50 % / 46 %)
      const hx = r.left + r.width * 0.62 - box.left;
      const hy = r.top + r.height * 0.42 - box.top;
      const st0 = st.getBoundingClientRect();
      shift = `${(st0.left + st0.width * 0.5 - box.left - hx).toFixed(0)}px ${(st0.top + st0.height * 0.46 - box.top - hy).toFixed(0)}px`;
      for (const el of layers) el.style.transformOrigin = `${(hx / box.width) * 100}% ${(hy / box.height) * 100}%`;
    } else if (!zoomed.length) return;
    const ms = motion.reduced() ? 0 : on ? 2500 : 900;
    const near = { scale: String(ZOOM), translate: shift };
    const far = { scale: '1', translate: '0px 0px' };
    zoomed.forEach((a) => a.cancel());
    zoomed = layers.map((el) => el.animate(on ? [far, near] : [near, far], { duration: ms, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' }));
    if (!on) {
      const done = zoomed;
      Promise.all(done.map((a) => a.finished)).then(
        () => done.forEach((a) => a.cancel()),
        () => {},
      );
      zoomed = [];
    }
  };

  /** Где на экране его рука у стекла и какого она размера, относительно ладони во весь размер. */
  const fromHand = () => {
    const r = hero.el.getBoundingClientRect();
    const p = palm.getBoundingClientRect();
    const dx = r.left + r.width * 0.62 - (p.left + p.width / 2);
    const dy = r.top + r.height * 0.42 - (p.top + p.height / 2);
    const k = Math.max(0.05, (r.width * 0.16) / (p.width || 1));
    return `translate(${dx.toFixed(0)}px, ${dy.toFixed(0)}px) scale(${k.toFixed(3)})`;
  };

  /** Рука героя тянется к стеклу — и вырастает в ладонь на нашем экране; два-три тихих толчка, экран чуть вздрагивает. */
  const touch = async () => {
    hero.set('palm');
    stage()?.append(palm);
    await ctx.wait(motion.reduced() ? 0 : 500);
    palm.classList.add('is-on');
    if (motion.reduced()) return;
    palm.animate([{ transform: fromHand(), opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, easing: 'cubic-bezier(.3,0,.2,1)' });
    for (let i = 0; i < 3; i++) {
      await ctx.wait(i ? 520 : 900);
      if (s.signal.aborted) return;
      palm.animate([{ scale: '1' }, { scale: '1.035' }, { scale: '1' }], { duration: 260, easing: 'ease-out' });
      stage()?.querySelector('.world')?.animate([{ translate: '0 0' }, { translate: '0 2px' }, { translate: '0 0' }], { duration: 200 });
    }
  };

  // долго не отпускает — ещё две реплики по 20 секунд
  const armLong = () => {
    s.clear(longTimer);
    longTimer = s.after(LONG_MS, async () => {
      if (released) return;
      await ctx.say(ctx.lines('hold20'));
      longTimer = s.after(LONG_MS, () => !released && ctx.say(ctx.lines('hold40')));
    });
  };

  const fall = async () => {
    if (ctx.lap === 2) {
      // после второго круга падения нет: герой съезжает по стеклу на нижнюю кромку окна и садится
      await hero.go(50, 100, { state: 'fall', ms: motion.reduced() ? 0 : 900, stride: 30, signal: s.signal });
      hero.set('sit');
      await ctx.wait(1200);
      return onDone();
    }
    // transform, а не translate: translate у героя занят якорем, и падение начиналось бы с рывка
    const anim = motion.reduced()
      ? hero.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' })
      : hero.el.animate(
          [
            { transform: 'translateY(0)', opacity: 1, offset: 0 },
            { transform: 'translateY(30vh)', opacity: 1, offset: 0.55 },
            { transform: 'translateY(90vh)', opacity: 0, offset: 1 },
          ],
          { duration: 1600, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' },
        );
    anim.finished.then(onDone, onDone);
  };

  const release = () => {
    if (!ready || released) return;
    released = true;
    hint.stop();
    s.clear(longTimer);
    target.remove();
    button.remove();
    // ладонь уходит обратно в его руку и соскальзывает со стекла, камера отъезжает
    if (!motion.reduced() && palm.isConnected) palm.animate([{ transform: 'none' }, { transform: fromHand() }], { duration: 500, easing: 'ease-in', fill: 'forwards' });
    palm.classList.remove('is-on');
    palm.classList.add('is-off');
    closeup(false);
    if (ctx.lap === 2) return void fall();
    // пальцы раскрываются — и падение; страховка, если последний кадр не наступит (пауза, сбой загрузки)
    let fell = false;
    const once = () => !fell && ((fell = true), fall());
    hero.set('letgo', once);
    s.after(1500, once);
  };

  return {
    async start() {
      hint.poke();
      hero.set('hang');
      hero.attach(target);
      target.addEventListener('click', release, { signal: s.signal });
      palm.addEventListener('click', release, { signal: s.signal });
      target.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), release()), { signal: s.signal });
      button.addEventListener('click', release, { signal: s.signal });

      closeup(true);
      await ctx.wait(motion.reduced() ? 0 : 2500);
      if (s.signal.aborted) return;

      // реплики по порядку; ладонь ложится на стекло, когда он понимает, что это стекло
      const seq = ctx.lines('sequence');
      const at = seq.findIndex((l) => textOf(l).includes('стекло'));
      const split = at < 0 ? 0 : at;
      await ctx.say(seq.slice(0, split));
      if (s.signal.aborted) return;
      void touch();
      await ctx.say(seq.slice(split));
      if (s.signal.aborted || released) return;
      ready = true;
      target.classList.add('is-ready');
      ctx.controls.append(button);
      focus(target);
      armLong();
    },
    stop() {
      hint.stop();
      zoomed.forEach((a) => a.cancel());
      zoomed = [];
      s.dispose();
    },
  };
};
