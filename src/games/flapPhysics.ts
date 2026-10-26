// Физика «Взмаха» без DOM. x — % ширины зала, alt — 0 (пол) … 1 (горло), время — мс.
// Крылья неудобные, но предсказуемые: каждое восстанавливается ~350 мс, левое толкает вверх
// и вправо, правое — вверх и влево. Поочерёдно в ритме — ровно вверх; чаще — крылья путаются:
// взмах слабеет и покачивает; одно крыло подряд — уводит вбок.

export type Side = 'left' | 'right';

export interface Ledge {
  alt: number;
  x0: number;
  x1: number;
}

export const PHYS = {
  gravity: 0.45, // alt/с²
  drag: 3, // 1/с: без взмахов снижение ~gravity/drag = 0.15 alt/с
  lift: 0.4, // alt/с за полный взмах
  push: 9, // %/с вбок за полный взмах
  dragX: 3, // 1/с
  recoverMs: 350,
  cross: 1.5, // насколько мешает другое, ещё не восстановившееся крыло
  wobble: 6, // %/с: покачивание от спутанного взмаха
  tilt: 8, // градусов наклона при самом слабом взмахе
  tiltDecay: 5, // 1/с
  wallL: 22,
  wallR: 78,
  wallSoft: 6, // в стольких % от стены начинает отталкивать
  wallK: 40, // 1/с² на % проникновения
  maxDt: 50,
};

export const LEDGES: Ledge[] = [
  { alt: 0, x0: 30, x1: 70 },
  { alt: 0.5, x0: 40, x1: 60 },
];

export interface Flight {
  x: number;
  alt: number;
  vx: number;
  vy: number;
  /** Время последнего взмаха каждого крыла; -Infinity — ещё не взмахивало. */
  lastL: number;
  lastR: number;
  t: number;
  /** Индекс выступа, на котором стоит; null — в воздухе. */
  perch: number | null;
  /** Наклон корпуса в градусах — только для картинки. */
  tilt: number;
  flaps: number;
}

export interface FlightOpts {
  /** false — без покачивания (reduced motion). */
  wobble?: boolean;
}

export function createFlight(x = 50, alt = 0): Flight {
  const perch = LEDGES.findIndex((l) => l.alt === alt && x >= l.x0 && x <= l.x1);
  return { x, alt, vx: 0, vy: 0, lastL: -Infinity, lastR: -Infinity, t: 0, perch: perch < 0 ? null : perch, tilt: 0, flaps: 0 };
}

/** Насколько крыло готово к новому взмаху: 0 — только что взмахнуло, 1 — восстановилось. */
export function recovery(f: Flight, side: Side): number {
  const last = side === 'left' ? f.lastL : f.lastR;
  return Math.min(1, Math.max(0, (f.t - last) / PHYS.recoverMs));
}

/**
 * Взмах. Сила = готовность этого крыла × готовность другого (в степени cross): если второе
 * ещё не довело свой взмах, они мешают друг другу. Лучше всего — поочерёдно ~3 раза в секунду.
 * Возвращает силу 0…1.
 */
export function flap(f: Flight, side: Side, opts: FlightOpts = {}): number {
  const other = side === 'left' ? 'right' : 'left';
  const strength = recovery(f, side) * recovery(f, other) ** PHYS.cross;
  const dir = side === 'left' ? 1 : -1;
  f.vy += PHYS.lift * strength;
  f.vx += PHYS.push * strength * dir;
  if (opts.wobble !== false) {
    // спутанный взмах качает в сторону, противоположную прошлому покачиванию
    const tangle = 1 - strength;
    const swing = f.flaps % 2 === 0 ? 1 : -1;
    f.vx += PHYS.wobble * tangle * swing;
    f.tilt = PHYS.tilt * tangle * swing;
  }
  if (side === 'left') f.lastL = f.t;
  else f.lastR = f.t;
  f.flaps++;
  if (f.vy > 0) f.perch = null;
  return strength;
}

/** Шаг времени в мс. */
export function step(f: Flight, dtMs: number) {
  const dt = Math.min(dtMs, PHYS.maxDt) / 1000;
  f.t += dt * 1000;
  f.tilt *= Math.exp(-PHYS.tiltDecay * dt);

  // стены: мягкая пружина у края и жёсткий упор на самой стене
  const inL = PHYS.wallL + PHYS.wallSoft - f.x;
  const inR = f.x - (PHYS.wallR - PHYS.wallSoft);
  if (inL > 0) f.vx += PHYS.wallK * inL * dt;
  if (inR > 0) f.vx -= PHYS.wallK * inR * dt;
  f.vx *= Math.exp(-PHYS.dragX * dt * (f.perch === null ? 1 : 4));
  f.x += f.vx * dt;
  if (f.x < PHYS.wallL) [f.x, f.vx] = [PHYS.wallL, Math.abs(f.vx) * 0.3];
  if (f.x > PHYS.wallR) [f.x, f.vx] = [PHYS.wallR, -Math.abs(f.vx) * 0.3];

  if (f.perch !== null) {
    const l = LEDGES[f.perch];
    // с выступа можно соскользнуть, если увело вбок
    if (l.alt > 0 && (f.x < l.x0 || f.x > l.x1)) f.perch = null;
    else {
      f.vy = 0;
      return;
    }
  }

  const before = f.alt;
  f.vy -= PHYS.gravity * dt;
  f.vy *= Math.exp(-PHYS.drag * dt);
  f.alt += f.vy * dt;
  if (f.alt >= 1) [f.alt, f.vy] = [1, 0];
  // выступы односторонние: снизу пролетаешь, сверху садишься
  if (f.vy < 0) {
    for (let i = 0; i < LEDGES.length; i++) {
      const l = LEDGES[i];
      const over = f.x >= l.x0 && f.x <= l.x1;
      if (before >= l.alt && f.alt < l.alt && (over || l.alt === 0)) {
        [f.alt, f.vy, f.perch] = [l.alt, 0, i];
        break;
      }
    }
  }
  if (f.alt <= 0) [f.alt, f.vy, f.perch] = [0, 0, 0];
}

export const atThroat = (f: Flight) => f.alt >= 1;
