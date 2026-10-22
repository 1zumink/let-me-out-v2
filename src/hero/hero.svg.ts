// Заглушка-стикмен: 2–4 кадра на состояние, кадр 256×256, ноги на y=236.
import type { HeroState } from './hero';

type P = [number, number];
interface Pose {
  head: P;
  neck: P;
  hip: P;
  arms: [P, P][]; // [локоть, кисть]
  legs: [P, P][]; // [колено, стопа]
  wings?: number; // угол взмаха, −1…1
}

const stand: Pose = {
  head: [128, 64],
  neck: [128, 88],
  hip: [128, 158],
  arms: [[[114, 122], [108, 154]], [[142, 122], [148, 154]]],
  legs: [[[120, 198], [114, 236]], [[136, 198], [142, 236]]],
};

const hangPose = (swing: number): Pose => ({
  head: [128, 92],
  neck: [128, 116],
  hip: [128 + swing, 178],
  arms: [[[112, 62], [108, 28]], [[144, 62], [148, 28]]],
  legs: [[[120 + swing * 2, 208], [116 + swing * 3, 236]], [[136 + swing * 2, 208], [140 + swing * 3, 236]]],
});

const shift = (p: Pose, dy: number): Pose => ({
  ...p,
  head: [p.head[0], p.head[1] + dy],
  neck: [p.neck[0], p.neck[1] + dy],
  arms: p.arms.map(([e, h]) => [[e[0], e[1] + dy], [h[0], h[1] + dy]] as [P, P]),
});

const POSES: Record<Exclude<HeroState, 'ghost'>, Pose[]> = {
  idle: [stand, shift(stand, -2)],
  breathe: [stand, shift(stand, -4), shift(stand, -6), shift(stand, -3)],
  climb: [
    { ...stand, arms: [[[110, 70], [104, 40]], [[146, 118], [150, 100]]], legs: [[[110, 190], [116, 236]], [[146, 186], [140, 214]]] },
    { ...stand, arms: [[[112, 116], [108, 98]], [[144, 70], [150, 40]]], legs: [[[112, 186], [118, 214]], [[144, 190], [138, 236]]] },
  ],
  slip: [
    { ...stand, head: [124, 70], arms: [[[100, 80], [92, 52]], [[156, 84], [166, 60]]], legs: [[[114, 200], [102, 236]], [[146, 196], [160, 230]]] },
    { ...stand, head: [132, 72], arms: [[[104, 84], [100, 56]], [[152, 80], [160, 50]]], legs: [[[110, 196], [98, 230]], [[140, 200], [152, 236]]] },
  ],
  hold: [
    { ...hangPose(-3), arms: [[[118, 62], [122, 26]], [[146, 140], [150, 160]]] },
    { ...hangPose(3), arms: [[[118, 62], [122, 26]], [[146, 142], [152, 162]]] },
  ],
  hang: [hangPose(-4), hangPose(0), hangPose(4), hangPose(0)],
  fly: [
    { ...stand, wings: 1 },
    { ...stand, wings: 0 },
    { ...stand, wings: -1 },
  ],
  letgo: [
    hangPose(0),
    { ...hangPose(0), arms: [[[110, 60], [100, 34]], [[146, 60], [156, 34]]] },
    { ...stand, head: [128, 80], neck: [128, 104], hip: [128, 170], arms: [[[100, 90], [80, 70]], [[156, 90], [176, 70]]], legs: [[[116, 204], [108, 236]], [[142, 200], [150, 228]]] },
  ],
};

const line = (pts: P[]) => 'M' + pts.map((p) => p.join(' ')).join(' L');

function render(p: Pose): string {
  const [hx, hy] = p.head;
  const parts = [
    line([p.neck, p.hip]),
    ...p.arms.map(([e, h]) => line([p.neck, e, h])),
    ...p.legs.map(([k, f]) => line([p.hip, k, f])),
  ];
  let wings = '';
  if (p.wings !== undefined) {
    const tip = 70 - p.wings * 40;
    wings = `<path d="M128 104 Q84 ${tip - 20} 52 ${tip} Q88 ${tip + 30} 128 118 M128 104 Q172 ${tip - 20} 204 ${tip} Q168 ${tip + 30} 128 118"/>`;
  }
  return (
    `<circle cx="${hx}" cy="${hy}" r="22"/>` +
    `<circle cx="${hx + 6}" cy="${hy - 2}" r="2.5" class="eye"/><circle cx="${hx + 13}" cy="${hy - 2}" r="2.5" class="eye"/>` +
    `<path d="${parts.join(' ')}"/>` +
    wings
  );
}

export function stickFrames(state: HeroState): string[] {
  const key = state === 'ghost' ? 'idle' : state;
  return POSES[key].map(render);
}
