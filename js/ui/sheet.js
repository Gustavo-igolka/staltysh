// Нижняя шторка (на ПК — окно по центру)
import { h } from '../core/dom.js';

let layer = null;

export function closeSheet() {
  layer?.remove();
  layer = null;
}

export function openSheet(title, body) {
  closeSheet();
  layer = h('div', { class: 'sheet-layer', onclick: (e) => { if (e.target === layer) closeSheet(); } },
    h('div', { class: 'sheet', role: 'dialog', 'aria-label': title },
      h('div', { class: 'sheet-head' },
        h('h3', null, title),
        h('button', { class: 'icon-btn', 'aria-label': 'Закрыть', onclick: closeSheet }, '✕')),
      h('div', { class: 'sheet-body' }, body)));
  document.body.append(layer);
  requestAnimationFrame(() => layer?.classList.add('open'));
}

export function confirmSheet(title, text, okLabel, onOk) {
  openSheet(title, h('div', null,
    h('p', null, text),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn danger', onclick: () => { closeSheet(); onOk(); } }, okLabel),
      h('button', { class: 'btn ghost', onclick: closeSheet }, 'Отмена'))));
}
