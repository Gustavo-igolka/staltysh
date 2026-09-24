import { h } from '../core/dom.js';

let box = null;

export function toast(msg, kind = 'info') {
  if (!box) { box = h('div', { class: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
  const el = h('div', { class: `toast ${kind}` }, msg);
  box.append(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), 3200);
}
