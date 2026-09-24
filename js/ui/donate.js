import { h } from '../core/dom.js';
import { getState } from '../core/state.js';
import { fmt } from '../core/util.js';
import { emptyState } from './common.js';

export function renderDonate(root) {
  const s = getState();
  root.append(
    h('h2', { class: 'screen-title' }, 'Донатный магазин'),
    h('section', { class: 'panel' },
      h('div', { class: 'balance' }, h('small', null, 'Хромогрониты'), h('b', { class: 'big' }, `◆ ${fmt(s.wallet.chromogroniti)}`))),
    emptyState('Товаров пока нет', 'Раздел и валюта готовы. Что здесь будет продаваться, определим позже.'));
}
