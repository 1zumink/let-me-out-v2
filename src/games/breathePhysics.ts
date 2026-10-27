// Логика «Вдоха» без DOM. p — 0 (начало коридора) … 1 (верх дымохода), время — мс.
// Каждый вдох поднимает на 1/steps за inhaleMs; чаще, чем раз в inhaleMs, вдохнуть нельзя —
// весь подъём не быстрее steps × inhaleMs, в спокойном ритме ~30 с.
// Не вдыхал dimMs — темнеет; slipMs — срыв: съезжает к началу, вдохи не помогают, пока не внизу.

export const BREATH = {
  steps: 20,
  inhaleMs: 1000,
  dimMs: 3000,
  slipMs: 6000,
  slidePerMs: 1 / 2000, // со всей высоты — за 2 с
  maxDt: 100,
};

export interface Climb {
  p: number;
  /** Куда ведут уже сделанные вдохи. */
  target: number;
  t: number;
  /** Время последнего вдоха. */
  last: number;
  /** Сколько мс без вдоха — без того времени, пока часы стояли. */
  quiet: number;
  breaths: number;
  slipping: boolean;
  slips: number;
}

export function createClimb(): Climb {
  return { p: 0, target: 0, t: 0, last: -Infinity, quiet: 0, breaths: 0, slipping: false, slips: 0 };
}

/** Вдох. false — не засчитан: срыв или прошлый вдох ещё идёт. */
export function inhale(c: Climb): boolean {
  if (c.slipping || atTop(c) || inhaling(c)) return false;
  c.breaths++;
  c.last = c.t;
  c.quiet = 0;
  c.target = Math.min(1, c.target + 1 / BREATH.steps);
  return true;
}

/** Шаг времени в мс. hold — часы бездействия стоят (герой говорит). */
export function step(c: Climb, dtMs: number, hold = false) {
  const dt = Math.min(dtMs, BREATH.maxDt);
  c.t += dt;
  if (!hold) c.quiet += dt;
  if (c.slipping) {
    c.p = Math.max(0, c.p - dt * BREATH.slidePerMs);
    if (c.p === 0) [c.slipping, c.quiet] = [false, 0];
    return;
  }
  c.p = Math.min(c.target, c.p + dt / (BREATH.steps * BREATH.inhaleMs));
  // у самого начала срываться некуда — просто темно
  if (idle(c) > BREATH.slipMs && c.p > 0 && !atTop(c)) {
    c.slipping = true;
    c.target = 0;
    c.slips++;
  }
}

export const idle = (c: Climb) => c.quiet;
export const inhaling = (c: Climb) => !c.slipping && c.t - c.last < BREATH.inhaleMs;
export const dim = (c: Climb) => c.slipping || (!atTop(c) && idle(c) > BREATH.dimMs);
export const atTop = (c: Climb) => c.p >= 1;
