// Сайд-сцены S1–S12 — не текст на бумажке, а событие в шахте: человечек висит на другой стене и говорит
// облачком, улитка ползёт, птица ныряет, сверху светит фонарь. Только на остановках, не больше одной
// на место, каждая — раз за круг (правила выбора — pick.ts).
import { h } from '../dom';
import { motion } from '../a11y';
import { heroSpec, type Place, type Scene, type SceneAct, type SceneActor, type SceneStep, type Ui } from '../data';
import { memory } from '../memory';
import type { Rng } from '../rng';
import type { Store } from '../state';
import { Hero, type HeroState } from '../hero/hero';
import type { Bubbles } from '../ui/SpeechBubble';
import { Creature, type CreatureKind } from '../ui/Creature';
import { pickScene } from './pick';
import { sceneTags } from '../route';
import { paperTilt, tornPolygon } from './paper';
import { textureUrl } from '../scene/textures';

// нет выбора столько времени — сцена договаривает «иначе» (S1: «Ладно, я своим темпом»)
const CHOICE_MS = 10000;
const ENTER_MS = 900;
const LEAVE_MS = 600;
const LINGER_MS = 1200;

// позы другого человечка: своя лента stranger-*, пока её нет — лента героя (FALLBACK в hero.ts)
const POSE: Record<string, HeroState> = {
  climb: 'stranger-climb',
  hang: 'stranger-hang',
  held: 'stranger-wave',
  slip: 'stranger-slip',
  wave: 'stranger-wave',
};

interface Actor {
  def: SceneActor;
  el: HTMLElement;
  hero?: Hero;
  x: number;
  y: number;
}

export interface SideScenesDeps {
  /** игровая область, где стоит герой: актёры живут рядом с ним */
  layer: HTMLElement;
  /** док: сюда — кнопки выбора */
  controls: HTMLElement;
  bubbles: Bubbles;
  hero: Hero;
  store: Store;
  scenes: Scene[];
  rng: Rng;
  ui: Ui;
}

export function createSideScenes({ layer, controls, bubbles, hero, store, scenes, rng }: SideScenesDeps) {
  let shownAt: Record<string, string> = {};
  const placesWithScene = new Set<string>();
  let open: { close: () => void } | null = null;

  const wait = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve) => {
      const id = window.setTimeout(resolve, ms);
      signal.addEventListener('abort', () => (clearTimeout(id), resolve()), { once: true });
    });

  const animate = (el: HTMLElement, frames: Keyframe[], ms: number) =>
    motion.reduced() ? Promise.resolve() : el.animate(frames, { duration: ms, easing: 'ease-out', fill: 'both' }).finished.catch(() => {});

  /** Ставит актёра: напротив героя по умолчанию, чтобы не закрывать его. */
  function build(def: SceneActor, signal: AbortSignal): Actor {
    const [hx] = hero.position;
    const opposite = def.side !== 'same';
    const x = opposite ? (hx > 50 ? 24 : 76) : hx > 50 ? 70 : 30;
    const y = def.y ?? 50;
    let el: HTMLElement;
    let stick: Hero | undefined;

    switch (def.kind) {
      case 'stick': {
        // другой человечек — та же линия, что у героя, но тоньше, тусклее и меньше
        stick = new Hero(heroSpec, import.meta.env.BASE_URL);
        el = stick.el;
        el.classList.add('scene-stick');
        el.classList.toggle('scene-stick--tiny', !!def.tiny);
        el.setAttribute('aria-hidden', 'true');
        layer.append(el);
        stick.flip(x > 50);
        stick.put(x, y, def.anchor);
        stick.set(POSE[def.pose ?? 'hang'] ?? 'stranger-hang');
        break;
      }
      case 'creature':
        el = Creature(def.creature as CreatureKind, { x, y, size: 64, rng, signal }) as unknown as HTMLElement;
        el.classList.add('scene-creature');
        layer.append(el);
        break;
      case 'cutout':
        el = h('img.cutout.scene-cutout', { src: import.meta.env.BASE_URL + def.src, alt: def.alt ?? '', loading: 'lazy' });
        el.style.left = `${x}%`;
        el.style.top = `${y}%`;
        el.style.width = `max(40px, calc(${def.w ?? 9} * 1vmin))`;
        el.classList.toggle('scene-cutout--ring', !!def.ring);
        layer.append(el);
        break;
      case 'sign':
        // «ВЫХОД — 3 ЭТАЖА ↑» — настоящий текст на эмалированной табличке
        el = h('div.scene-sign', { role: 'img' });
        el.style.left = `${x}%`;
        el.style.top = `${y}%`;
        layer.append(el);
        break;
      case 'note': {
        // записка остаётся бумагой: это и есть бумажка в трещине
        el = h('div.scene-note');
        el.style.left = `${x}%`;
        el.style.top = `${y}%`;
        el.style.setProperty('--tilt', `${paperTilt(rng).toFixed(1)}deg`);
        el.style.setProperty('--torn', tornPolygon(rng));
        const paper = textureUrl('paper');
        if (paper) el.style.setProperty('--paper', `url("${paper}")`);
        layer.append(el);
        break;
      }
      default: {
        // голос без тела: точка у верхнего или нижнего края, облачко тянется к ней
        el = h('div.scene-voice', { 'aria-hidden': 'true' });
        el.style.left = `${def.from === 'top' ? x : 50}%`;
        el.style.top = def.from === 'top' ? '0%' : '100%';
        layer.append(el);
        if (def.beam) {
          const beam = h('div.scene-beam', { 'aria-hidden': 'true' });
          beam.style.left = `${x}%`;
          layer.append(beam);
          (el as HTMLElement & { beam?: HTMLElement }).beam = beam;
        }
      }
    }
    if (def.ledge) {
      // вещь лежит на маленьком выступе
      const ledge = h('div.scene-ledge', { 'aria-hidden': 'true' });
      ledge.style.left = `${x}%`;
      ledge.style.top = `${y}%`;
      layer.append(ledge);
      (el as HTMLElement & { ledge?: HTMLElement }).ledge = ledge;
    }
    if (def.rope) {
      const rope = h('div.scene-rope', { 'aria-hidden': 'true' });
      rope.style.left = `${x}%`;
      layer.append(rope);
      (el as HTMLElement & { rope?: HTMLElement }).rope = rope;
    }
    if (def.hidden) el.hidden = true;
    return { def, el, hero: stick, x, y };
  }

  /** Появление: человечек вылезает снизу по верёвке или проступает; вещи и существа — проявляются. */
  async function enter(a: Actor) {
    if (a.el.hidden) return;
    const extras = [(a.el as { rope?: HTMLElement }).rope, (a.el as { ledge?: HTMLElement }).ledge, (a.el as { beam?: HTMLElement }).beam];
    extras.forEach((e) => e && animate(e, [{ opacity: 0 }, { opacity: 1 }], ENTER_MS));
    if (a.def.kind === 'stick' && a.def.enter === 'climb-in' && a.hero) {
      a.hero.set('stranger-climb');
      a.hero.put(a.x, a.y + 40, a.def.anchor);
      a.el.classList.add('is-floating');
      a.hero.place(a.x, a.y, a.def.anchor);
      await wait(motion.reduced() ? 0 : 1400, new AbortController().signal);
      a.el.classList.remove('is-floating');
      a.hero.set(POSE[a.def.pose ?? 'hang']);
      return;
    }
    if (a.def.kind === 'creature' && a.def.path === 'dive') {
      // птица ныряет в шахту и так же легко вылетает
      return void animate(
        a.el,
        [
          { transform: 'translate(-60vw, -40vh) rotate(25deg)', opacity: 0 },
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 1, offset: 0.45 },
          { transform: 'translate(10vw, 12vh) rotate(-10deg)', offset: 0.6 },
          { transform: 'translate(55vw, -50vh) rotate(-30deg)', opacity: 0 },
        ],
        7000,
      );
    }
    if (a.def.kind === 'creature' && a.def.path === 'crawl') {
      // улитка не торопится — и всё равно ползёт вверх по стене
      animate(a.el, [{ opacity: 0 }, { opacity: 1 }], ENTER_MS);
      return void animate(a.el, [{ translate: '-50% -50%' }, { translate: '-50% -260%' }], 14000);
    }
    await animate(a.el, [{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], ENTER_MS);
  }

  async function leave(a: Actor, quick: boolean) {
    const ms = quick ? 250 : LEAVE_MS;
    const extras = [(a.el as { rope?: HTMLElement }).rope, (a.el as { ledge?: HTMLElement }).ledge, (a.el as { beam?: HTMLElement }).beam];
    await Promise.all([a.el, ...extras].filter(Boolean).map((e) => animate(e as HTMLElement, [{ opacity: 1 }, { opacity: 0 }], ms)));
    extras.forEach((e) => e?.remove());
    if (a.hero) a.hero.destroy();
    else a.el.remove();
  }

  /** Действие перед репликой. */
  async function act(kind: SceneAct, actors: Map<string, Actor>, signal: AbortSignal) {
    const other = actors.get('other');
    if (kind === 'slip' && other?.hero) {
      // сползает вниз быстрее, чем можно объяснить
      other.hero.set('stranger-slip');
      other.el.classList.add('is-slow');
      other.hero.place(other.x, 115, other.def.anchor);
    }
    if (kind === 'wave' && other?.hero) {
      other.hero.set('stranger-wave');
      other.el.classList.add('is-slow');
      other.hero.place(other.x, other.y + 30, other.def.anchor);
    }
    if (kind === 'ledge' && other?.hero) {
      // рядом проступает выступ, попутчик перебирается на него и остаётся позади
      const ledge = h('div.scene-ledge', { 'aria-hidden': 'true' });
      // выступ — ближе к стене, а не посреди сцены
      const lx = other.x > 50 ? Math.min(other.x + 9, 88) : Math.max(other.x - 9, 12);
      ledge.style.left = `${lx}%`;
      ledge.style.top = `${other.y + 18}%`;
      layer.append(ledge);
      (other.el as { ledge?: HTMLElement }).ledge = ledge;
      await animate(ledge, [{ opacity: 0 }, { opacity: 1 }], 500);
      other.hero.set('stranger-climb');
      other.hero.place(lx, other.y + 18);
      await wait(900, signal);
      other.hero.set('idle');
    }
    if (kind === 'out') {
      // из банки выбирается крошечный человечек и сразу начинает лезть рядом
      const tiny = actors.get('tiny');
      const jar = actors.get('jar');
      jar?.el.classList.add('is-glowing');
      if (tiny?.hero) {
        tiny.el.hidden = false;
        // вылезает из-под крышки и лезет рядом с банкой, не за ней
        const side = tiny.x > 50 ? -7 : 7;
        tiny.hero.put(tiny.x + side * 0.4, (jar?.y ?? tiny.y) - 8);
        tiny.hero.set('stranger-climb');
        tiny.el.classList.add('is-slow');
        tiny.hero.place(tiny.x + side, tiny.y - 12);
        await wait(700, signal);
      }
    }
    if (kind === 'beam-off') {
      const voice = actors.get('voice');
      const beam = (voice?.el as { beam?: HTMLElement } | undefined)?.beam;
      if (beam) await animate(beam, [{ opacity: 1 }, { opacity: 0 }], 500);
      beam?.remove();
    }
    if (kind === 'answer') actors.get('phone')?.el.classList.remove('scene-cutout--ring');
  }

  /** Табличка и записка показывают текст на себе; остальные говорят облачком. */
  async function line(step: Extract<SceneStep, { text: string }>, actors: Map<string, Actor>, signal: AbortSignal) {
    const actor = actors.get(step.who);
    if (actor && (actor.def.kind === 'sign' || actor.def.kind === 'note')) {
      actor.el.append(h('p', {}, step.text));
      actor.el.setAttribute('aria-label', step.text);
      await animate(actor.el, [{ opacity: 0.4 }, { opacity: 1 }], 400);
      return wait(1800 + step.text.length * 45, signal);
    }
    const voice = actor?.def.kind === 'voice';
    await bubbles.say([{ who: step.who, text: step.text, small: step.small || (voice && actor?.def.from === 'bottom'), pale: step.pale }], signal);
  }

  /** Кнопки выбора — в доке рядом с «выше»; нет выбора — «иначе». */
  function choose(step: Extract<SceneStep, { choice: unknown }>, signal: AbortSignal) {
    return new Promise<{ steps: SceneStep[]; act?: SceneAct; effect?: string } | null>((resolve) => {
      const box = h('div.scene-choices');
      const done = (v: { steps: SceneStep[]; act?: SceneAct; effect?: string } | null) => {
        clearTimeout(timer);
        box.remove();
        resolve(v);
      };
      for (const opt of step.choice) {
        const b = h('button.btn', { type: 'button' }, opt.label);
        b.addEventListener('click', () => done(opt), { signal });
        box.append(b);
      }
      controls.prepend(box);
      const timer = window.setTimeout(() => done(step.otherwise ? { steps: step.otherwise } : null), CHOICE_MS);
      signal.addEventListener('abort', () => done(null), { once: true });
    });
  }

  async function run(steps: SceneStep[], actors: Map<string, Actor>, signal: AbortSignal) {
    for (const step of steps) {
      if (signal.aborted) return;
      if ('choice' in step) {
        const picked = await choose(step, signal);
        if (!picked || signal.aborted) return;
        if (picked.effect === 'jar') memory.set({ jar: true });
        if (picked.act) await act(picked.act, actors, signal);
        await run(picked.steps, actors, signal);
        return;
      }
      if (step.delayMs) await wait(step.delayMs, signal);
      if (step.act) await act(step.act, actors, signal);
      await line(step, actors, signal);
    }
  }

  function show(scene: Scene) {
    const ac = new AbortController();
    const signal = ac.signal;
    const actors = new Map<string, Actor>();
    for (const [id, def] of Object.entries(scene.stage.actors)) {
      const a = build(def, signal);
      actors.set(id, a);
      // облачко тянет хвостик к этому актёру
      if (def.kind !== 'sign' && def.kind !== 'note') bubbles.speaker(id, a.el);
    }
    let quick = false;
    const finish = async () => {
      for (const id of actors.keys()) bubbles.speaker(id, null);
      await Promise.all([...actors.values()].map((a) => leave(a, quick)));
      if (open?.close === close) open = null;
    };
    const close = () => {
      if (signal.aborted) return;
      quick = true;
      ac.abort();
    };
    open = { close };
    (async () => {
      await Promise.all([...actors.values()].map(enter));
      await run(scene.steps, actors, signal);
      if (!signal.aborted) await wait(LINGER_MS, signal);
      await finish();
    })();
  }

  return {
    /** Вызывается на остановке места; сам решает, показывать ли сцену. route — маршрут этого круга. */
    maybeShow(placeData: Place, route: Place[], force?: string | null) {
      const s = store.get();
      if (s.phase !== 'stop' || open) return;
      const place = placeData.id;
      const key = `${s.lap}:${place}`;
      // ?scene=S2 — показать эту сцену на первой же остановке (для проверки постановки)
      const forced = force ? scenes.find((sc) => sc.id === force && !(sc.id in shownAt)) : undefined;
      const scene =
        forced ??
        pickScene({
          scenes,
          lap: s.lap,
          place,
          tags: sceneTags(placeData),
          order: route.map((p) => p.id),
          shownAt,
          seenEver: memory.get().seenEver,
          floorHadScene: placesWithScene.has(key),
          rng,
        });
      placesWithScene.add(key);
      if (!scene) return;
      shownAt = { ...shownAt, [scene.id]: place };
      store.seeScene(scene.id);
      memory.see(scene.id);
      show(scene);
    },
    close: () => open?.close(),
    get isOpen() {
      return open !== null;
    },
    /** Новый круг: места снова могут получить сцену. */
    reset() {
      open?.close();
      placesWithScene.clear();
      shownAt = {};
    },
  };
}
