import { h } from '../dom';
import type { Ui } from '../data';

/** «уйти» — всегда в правом верхнем углу, на каждом экране. */
export function ExitButton(ui: Ui, onExit: () => void) {
  const btn = h('button.btn.btn--exit', { type: 'button' }, ui.exit);
  btn.addEventListener('click', onExit);
  return btn;
}
