// Герой: лента кадров (background-position + steps(N)) или SVG-заглушка, если ленты нет.
import { motion } from '../a11y';
import { stickFrames } from './hero.svg';

export type HeroState =
  | 'idle'
  | 'sit'
  | 'climb'
  | 'slip'
  | 'hold'
  | 'held'
  | 'breathe'
  | 'fly'
  | 'ghost'
  | 'hang'
  | 'letgo'
  // движение между местами: шаг по уступу, лазание по стене в профиль, прыжок, вылезание на край
  | 'walk'
  | 'wall'
  | 'jump'
  | 'mantle'
  | 'fall'
  | 'chimney'
  | 'palm'
  // другой человечек из сайд-сцен (попутчик, человечек на стене, крошечный из банки)
  | 'stranger-climb'
  | 'stranger-hang'
  | 'stranger-slip'
  | 'stranger-wave';
export interface StripSpec {
  frames: number;
  fps: number;
  loop: boolean;
  /** feet — ноги на y=236 (по умолчанию); top — руки на y=16, для висящих состояний */
  align?: 'feet' | 'top';
}
export type HeroSpec = Partial<Record<HeroState, StripSpec>>;

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_FPS = 4;
// кадр 256: ноги на y=236, руки висящих поз — на y≈18
const FEET = 236 / 256;
const HANDS = 18 / 256;
// если ленты нового состояния ещё нет — ближайшая из нарисованных
const FALLBACK: Partial<Record<HeroState, HeroState>> = {
  sit: 'idle',
  held: 'hold',
  ghost: 'idle',
  walk: 'idle',
  wall: 'climb',
  jump: 'climb',
  mantle: 'climb',
  fall: 'slip',
  chimney: 'climb',
  palm: 'hang',
  'stranger-climb': 'climb',
  'stranger-hang': 'hang',
  'stranger-slip': 'slip',
  'stranger-wave': 'held',
};

// какие ленты реально загрузились; общий кеш на всех героев (герой и его призрак)
const loaded = new Map<string, Promise<boolean>>();
function loadStrip(url: string): Promise<boolean> {
  if (!loaded.has(url)) {
    loaded.set(
      url,
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      }),
    );
  }
  return loaded.get(url)!;
}

export class Hero {
  readonly el: HTMLDivElement;
  private sprite: HTMLDivElement;
  private svg: SVGSVGElement;
  private anim: Animation | null = null;
  private svgTimer = 0;
  private token = 0;
  private _state: HeroState = 'idle';
  private onceDone: (() => void) | null = null;
  private offMotion: () => void;
  /** Кадр задаёт прокрутка (0…1), а не время; null — лента играет сама. */
  private scrubT: number | null = null;
  private svgFrames: string[] = [];
  private walking = 0;

  constructor(
    private spec: HeroSpec,
    private base: string,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'hero';
    this.sprite = document.createElement('div');
    this.sprite.className = 'hero__sprite boil';
    this.sprite.setAttribute('aria-hidden', 'true');
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('viewBox', '0 0 256 256');
    this.svg.classList.add('hero__svg', 'boil');
    this.svg.setAttribute('aria-hidden', 'true');
    this.el.append(this.sprite, this.svg);
    this.offMotion = motion.onChange(() => this.replay());
  }

  get state() {
    return this._state;
  }

  /** Мгновенная смена состояния. Для незацикленных лент onEnd вызовется на последнем кадре. */
  set(state: HeroState, onEnd?: () => void) {
    this.scrubT = null;
    this._state = state;
    this.onceDone = onEnd ?? null;
    this.el.classList.toggle('is-ghost', state === 'ghost');
    this.el.dataset.state = state;
    this.replay();
  }

  /** Кадр ленты по прокрутке: t — фаза 0…1. Прокрутка встала — встал и кадр. */
  scrub(state: HeroState, t: number) {
    const was = this.scrubT !== null && this._state === state;
    this.scrubT = Math.min(1, Math.max(0, t));
    if (!was) {
      this._state = state;
      this.onceDone = null;
      this.el.classList.toggle('is-ghost', false);
      this.el.dataset.state = state;
      this.replay();
    } else this.seek();
  }

  /** Идёт по уступу до x за ms: шаг в такт пути, без скольжения. */
  walkTo(x: number, ms = 900, signal?: AbortSignal) {
    // два шага на цикл ленты — ~0.55 ширины героя, как в climbPath.stride
    return this.go(x, this.position[1], { state: 'walk', ms, stride: this.box().w * 0.55, signal });
  }

  /** Перемещение по прямой с лентой state, кадры — по пройденному пути (stride % на цикл).
   * Так любое перемещение внутри места — шаг, перехват или долёт, а не скольжение по воздуху. */
  go(x: number, y: number, { state, ms = 900, stride = 7, signal }: { state: HeroState; ms?: number; stride?: number; signal?: AbortSignal }): Promise<void> {
    const token = ++this.walking;
    const [x0, y0] = this.position;
    const dx = x - x0;
    const dy = y - y0;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.3 || motion.reduced()) {
      this.place(x, y);
      return Promise.resolve();
    }
    if (Math.abs(dx) > 0.5) this.flip(dx < 0);
    this.el.classList.add('is-tracking');
    const t0 = performance.now();
    return new Promise((resolve) => {
      const tick = (now: number) => {
        if (token !== this.walking || signal?.aborted) return resolve();
        const u = Math.min(1, (now - t0) / ms);
        this.place(x0 + dx * u, y0 + dy * u);
        this.scrub(state, ((dist * u) / stride) % 1);
        if (u < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  /** Элементы, привязанные к телу героя (рука, грудь): координаты в долях кадра. */
  attach(el: HTMLElement) {
    this.el.append(el);
    return el;
  }

  /** Сброс после падения и прочих перемещений самого элемента. */
  reset() {
    this.walking++;
    this.el.getAnimations().forEach((a) => a.cancel());
    this.el.style.opacity = '';
    this.el.style.transform = '';
    this.el.hidden = false;
    this.el.classList.remove('is-tracking', 'is-blink', 'is-floating', 'is-dragging', 'is-sway');
  }

  /** Скорость покадровой анимации (крылья бьют сильнее или слабее). */
  rate(r: number) {
    if (this.anim) this.anim.playbackRate = r;
  }

  flip(left: boolean) {
    this.el.style.setProperty('--flip', left ? '-1' : '1');
  }

  /** Ставит героя в точку (x, y) в процентах от родителя: ногами или, если висит, руками.
   * Якорь в CSS один — ноги; точка рук пересчитывается, чтобы смена позы не давала скачка. */
  place(x: number, y: number, anchor: 'feet' | 'hands' = 'feet') {
    this.el.style.left = `${x}%`;
    this.el.style.top = `${this.toFeet(y, anchor)}%`;
  }

  /** Поставить сразу, без перехода: появление на месте (загрузка, новый круг), а не путь к нему. */
  put(x: number, y: number, anchor: 'feet' | 'hands' = 'feet') {
    this.el.classList.add('is-tracking');
    this.place(x, y, anchor);
    void this.el.offsetWidth;
    this.el.classList.remove('is-tracking');
  }

  /** y точки ног (в % родителя) для позы, заданной ногами или руками. */
  toFeet(y: number, anchor: 'feet' | 'hands' = 'feet') {
    if (anchor === 'feet') return y;
    const parent = this.el.parentElement?.clientHeight || 0;
    const size = this.el.offsetHeight || parent * 0.26;
    return parent ? y + ((FEET - HANDS) * size * 100) / parent : y + 22;
  }

  /** Размер героя в процентах ширины и высоты родителя. */
  box(): { w: number; h: number } {
    const p = this.el.parentElement;
    const size = this.el.offsetWidth;
    if (!p || !size || !p.clientWidth) return { w: 20, h: 26 };
    return { w: (size / p.clientWidth) * 100, h: (size / p.clientHeight) * 100 };
  }

  /** Где герой сейчас, в процентах от родителя. */
  get position(): [number, number] {
    return [parseFloat(this.el.style.left) || 50, parseFloat(this.el.style.top) || 78];
  }

  destroy() {
    this.token++;
    this.stop();
    this.offMotion();
    this.el.remove();
  }

  private stripFor(state: HeroState): HeroState {
    return this.stripsFor(state)[0] ?? state;
  }

  /** Ленты, которые могут сыграть состояние, по порядку: своя, затем запасная. */
  private stripsFor(state: HeroState): HeroState[] {
    return [state, FALLBACK[state]].filter((k): k is HeroState => !!k && !!this.spec[k]);
  }

  private async replay() {
    const token = ++this.token;
    this.stop();
    // своя лента, а если её файла ещё нет — ближайшая нарисованная (FALLBACK), и только потом заглушка
    for (const key of this.stripsFor(this._state)) {
      const strip = this.spec[key]!;
      const webp = `${this.base}assets/hero/${key}.webp`;
      const png = `${this.base}assets/hero/${key}.png`;
      const url = (await loadStrip(webp)) ? webp : (await loadStrip(png)) ? png : null;
      if (token !== this.token) return;
      if (!url) continue;
      // какая лента реально играет: у настоящей ленты призрака пунктир уже нарисован
      this.el.dataset.strip = key;
      return this.playStrip(url, strip);
    }
    this.el.dataset.strip = this._state;
    this.playSvg();
  }

  private stop() {
    this.anim?.cancel();
    this.anim = null;
    this.svgFrames = [];
    clearInterval(this.svgTimer);
  }

  private finish() {
    const fn = this.onceDone;
    this.onceDone = null;
    fn?.();
  }

  private playStrip(url: string, { frames, fps, loop }: StripSpec) {
    this.el.dataset.mode = 'sprite';
    this.sprite.style.backgroundImage = `url("${url}")`;
    this.sprite.style.backgroundSize = `${frames * 100}% 100%`;
    this.sprite.style.backgroundPositionX = '0%';
    if (motion.reduced() || frames < 2) {
      // только первый кадр; незацикленное действие считаем завершённым сразу
      if (!loop) queueMicrotask(() => this.finish());
      return;
    }
    const keyframes = loop
      ? [{ backgroundPositionX: '0%' }, { backgroundPositionX: `${(frames / (frames - 1)) * 100}%` }]
      : [{ backgroundPositionX: '0%' }, { backgroundPositionX: '100%' }];
    this.anim = this.sprite.animate(keyframes, {
      duration: ((loop ? frames : frames - 1) / fps) * 1000,
      iterations: loop ? Infinity : 1,
      easing: `steps(${loop ? frames : frames - 1}, jump-end)`,
      fill: loop ? 'none' : 'forwards',
    });
    if (motion.paused()) this.anim.pause();
    if (!loop) this.anim.finished.then(() => this.finish(), () => {});
    this.seek();
  }

  /** Кадр по прокрутке: анимация на паузе, время — доля длительности. */
  private seek() {
    const t = this.scrubT;
    if (t === null) return;
    if (this.anim) {
      this.anim.pause();
      const d = Number(this.anim.effect?.getTiming().duration) || 0;
      // у цикла t=1 — снова первый кадр; у разовой ленты — последний
      this.anim.currentTime = Math.min(t, 0.9999) * d;
    } else if (this.svgFrames.length) {
      const n = this.svgFrames.length;
      this.svg.innerHTML = this.svgFrames[Math.min(n - 1, Math.floor(t * n))];
    }
  }

  private playSvg() {
    this.el.dataset.mode = 'svg';
    const frames = stickFrames(this._state);
    this.svgFrames = frames;
    const loop = this.spec[this.stripFor(this._state)]?.loop ?? true;
    let i = 0;
    this.svg.innerHTML = frames[0];
    if (this.scrubT !== null) return this.seek();
    if (motion.reduced()) {
      if (!loop) queueMicrotask(() => this.finish());
      return;
    }
    this.svgTimer = window.setInterval(() => {
      if (motion.paused()) return;
      i++;
      if (!loop && i >= frames.length) {
        clearInterval(this.svgTimer);
        this.finish();
        return;
      }
      this.svg.innerHTML = frames[i % frames.length];
    }, 1000 / SVG_FPS);
  }
}
