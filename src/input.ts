// Единый ввод: клавиатура и свайпы → действия; удержание и нажатие на конкретных элементах.
export type Action = 'up' | 'left' | 'right' | 'down' | 'escape';

const KEYS: Record<string, Action> = {
  ArrowUp: 'up',
  PageUp: 'up',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowDown: 'down',
  Escape: 'escape',
};

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function createInput(root: HTMLElement) {
  const handlers = new Map<Action, Set<(e?: Event) => void>>();
  const fire = (a: Action, e?: Event) => {
    const set = handlers.get(a);
    if (!set?.size) return false;
    set.forEach((fn) => fn(e));
    return true;
  };

  window.addEventListener('keydown', (e) => {
    const action = KEYS[e.code] ?? KEYS[e.key];
    if (!action || typing(e.target) || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.repeat && action !== 'left' && action !== 'right' && action !== 'down') return;
    if (fire(action, e) && action !== 'escape') e.preventDefault();
  });

  // свайп вверх пальцем = «выше»
  let start: { x: number; y: number; id: number } | null = null;
  root.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') start = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  root.addEventListener('pointerup', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (dy < -60 && Math.abs(dx) < Math.abs(dy) * 0.7) fire('up', e);
  });
  root.addEventListener('pointercancel', () => (start = null));

  return {
    on(action: Action, fn: (e?: Event) => void) {
      if (!handlers.has(action)) handlers.set(action, new Set());
      handlers.get(action)!.add(fn);
      return () => handlers.get(action)!.delete(fn);
    },
  };
}

export type Input = ReturnType<typeof createInput>;

const isHoldKey = (e: KeyboardEvent) => e.code === 'Space' || e.key === ' ' || e.key === 'Enter';

/** Удержание: указатель на элементе или пробел/Enter, пока элемент в фокусе. */
export function bindHold(
  el: HTMLElement,
  { onStart, onEnd }: { onStart: () => void; onEnd: () => void },
  signal: AbortSignal,
) {
  let down = false;
  const begin = () => {
    if (down) return;
    down = true;
    onStart();
  };
  const end = () => {
    if (!down) return;
    down = false;
    onEnd();
  };
  const opts = { signal };
  el.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      el.focus({ preventScroll: true });
      begin();
    },
    opts,
  );
  el.addEventListener('pointerup', end, opts);
  el.addEventListener('pointercancel', end, opts);
  el.addEventListener('lostpointercapture', end, opts);
  el.addEventListener(
    'keydown',
    (e) => {
      if (!isHoldKey(e)) return;
      e.preventDefault();
      if (!e.repeat) begin();
    },
    opts,
  );
  el.addEventListener(
    'keyup',
    (e) => {
      if (!isHoldKey(e)) return;
      e.preventDefault();
      end();
    },
    opts,
  );
  el.addEventListener('blur', end, opts);
  el.addEventListener('contextmenu', (e) => e.preventDefault(), opts);
  return { get down() { return down; }, release: end };
}

/** Нажатие: указатель, пробел или Enter. Для не-<button> элементов с role="button". */
export function bindPress(el: HTMLElement, fn: () => void, signal: AbortSignal) {
  el.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.focus({ preventScroll: true });
      fn();
    },
    { signal },
  );
  el.addEventListener(
    'keydown',
    (e) => {
      if (!isHoldKey(e) || e.repeat) return;
      e.preventDefault();
      fn();
    },
    { signal },
  );
}
