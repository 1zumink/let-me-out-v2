// Герой: лента кадров (background-position + steps(N)) или SVG-заглушка, если ленты нет.
import { motion } from '../a11y';
import { stickFrames } from './hero.svg';

export type HeroState = 'idle' | 'climb' | 'slip' | 'hold' | 'breathe' | 'fly' | 'ghost' | 'hang' | 'letgo';
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
    this._state = state;
    this.onceDone = onEnd ?? null;
    this.el.classList.toggle('is-ghost', state === 'ghost');
    this.replay();
  }

  /** Элементы, привязанные к телу героя (рука, грудь): координаты в долях кадра. */
  attach(el: HTMLElement) {
    this.el.append(el);
    return el;
  }

  /** Сброс после падения и прочих перемещений самого элемента. */
  reset() {
    this.el.getAnimations().forEach((a) => a.cancel());
    this.el.style.opacity = '';
    this.el.hidden = false;
  }

  flip(left: boolean) {
    this.el.style.setProperty('--flip', left ? '-1' : '1');
  }

  /** Ставит героя в точку (x, y) в процентах от родителя: ногами или, если висит, руками. */
  place(x: number, y: number, anchor: 'feet' | 'hands' = 'feet') {
    this.el.classList.toggle('is-anchor-hands', anchor === 'hands');
    this.el.style.left = `${x}%`;
    this.el.style.top = `${y}%`;
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
    return state === 'ghost' ? 'idle' : state;
  }

  private async replay() {
    const token = ++this.token;
    const key = this.stripFor(this._state);
    const strip = this.spec[key];
    this.stop();
    const webp = `${this.base}assets/hero/${key}.webp`;
    const png = `${this.base}assets/hero/${key}.png`;
    let url: string | null = null;
    if (strip) {
      if (await loadStrip(webp)) url = webp;
      else if (await loadStrip(png)) url = png;
    }
    if (token !== this.token) return;
    if (strip && url) this.playStrip(url, strip);
    else this.playSvg();
  }

  private stop() {
    this.anim?.cancel();
    this.anim = null;
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
  }

  private playSvg() {
    this.el.dataset.mode = 'svg';
    const frames = stickFrames(this._state);
    const loop = this.spec[this.stripFor(this._state)]?.loop ?? true;
    let i = 0;
    this.svg.innerHTML = frames[0];
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
