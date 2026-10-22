import { h } from '../dom';
import { motion, setPaused } from '../a11y';
import type { Ui } from '../data';

/** Пауза любого автодвижения: туман, кипящая линия, анимация героя. */
export function PauseButton(ui: Ui) {
  const btn = h('button.btn.btn--pause', { type: 'button', 'aria-pressed': 'false' }, ui.pause);
  const sync = () => {
    btn.setAttribute('aria-pressed', String(motion.paused()));
    btn.textContent = motion.paused() ? ui.resume : ui.pause;
  };
  btn.addEventListener('click', () => setPaused(!motion.paused()));
  motion.onChange(sync);
  return btn;
}
