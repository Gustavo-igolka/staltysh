import { h } from '../core/dom.js';
import { getState, mutate } from '../core/state.js';
import { fmt } from '../core/util.js';
import { getItem } from '../data/items.js';
import { CASES, SKINS } from '../data/cases.js';
import { openCase, toggleSkin } from '../game/cases.js';
import { openSheet } from './sheet.js';
import { toast } from './toast.js';
import { rewardLabel } from './pass.js';


function label(r) {
  if (r.type === 'skin') return `Скин ${SKINS[r.id].name}`;
  return rewardLabel(r);
}

function showDrops(c) {
  const total = c.drops.reduce((s, d) => s + d.weight, 0);
  openSheet(c.name, h('div', null,
    h('p', { class: 'muted' }, c.desc),
    h('div', { class: 'rows' }, c.drops.map((d) => h('div', { class: 'row' },
      h('div', { class: 'row-main' }, h('b', null, label(d.reward))),
      h('div', { class: 'row-act' }, h('small', null, `${Math.round((d.weight / total) * 1000) / 10}%`)))))));
}

function caseCard(s, c) {
  return h('section', { class: 'panel' },
    h('h3', { class: 'panel-title' }, c.name),
    h('p', { class: 'muted' }, c.desc),
    h('div', { class: 'btn-row' },
      h('button', {
        class: 'btn primary', disabled: s.wallet.chromogroniti < c.price,
        onclick: () => {
          const r = mutate((st) => openCase(st, c.id));
          if (!r.ok) return toast(r.msg, 'warn');
          const extra = r.reward.type === 'item' ? ' (на складе)' : r.refund ? ` — скин уже был, возвращено ◆ ${r.refund}` : '';
          openSheet('Из кейса выпало', h('div', null, h('p', { class: 'big' }, label(r.reward)), h('small', { class: 'muted' }, extra)));
        },
      }, `Открыть · ◆ ${fmt(c.price)}`),
      h('button', { class: 'btn ghost', onclick: () => showDrops(c) }, 'Что внутри')));
}

function skinsPanel(s) {
  const list = Object.values(SKINS).filter((k) => s.skins.includes(k.id));
  if (!list.length) return null;
  return h('section', { class: 'panel' },
    h('h3', { class: 'panel-title' }, 'Мои скины'),
    h('div', { class: 'rows' }, list.map((k) => {
      const on = s.skinSel[k.for] === k.id;
      return h('div', { class: 'row' },
        h('div', { class: 'row-main' }, h('b', null, k.name), h('small', null, `для ${getItem(k.for).name} · ${k.desc}`)),
        h('div', { class: 'row-act' }, h('button', { class: 'btn small ghost', onclick: () => mutate((st) => toggleSkin(st, k.id)) }, on ? 'Снять' : 'Надеть')));
    })));
}

export function renderDonate(root) {
  const s = getState();
  root.append(
    h('h2', { class: 'screen-title' }, 'Донатный магазин'),
    h('section', { class: 'panel' },
      h('div', { class: 'balance' }, h('small', null, 'Хромогрониты'), h('b', { class: 'big' }, `◆ ${fmt(s.wallet.chromogroniti)}`))),
    h('p', { class: 'muted' }, 'В кейсах только расходники и косметика: сила вещей за донат не продаётся.'),
    ...CASES.map((c) => caseCard(s, c)),
    ...[skinsPanel(s)].filter(Boolean));
}
