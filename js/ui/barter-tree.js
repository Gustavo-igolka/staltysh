// Дерево бартера ветки: колонки — ступени слева направо (серая → красная), карточки-вещи и линии между ними.
// Каждая вещь покупается отдельно. Вещь доступна, когда куплена любая вещь, ведущая в неё. Тап по карточке — окно
// со статами, ценой и кнопкой «Купить».
import { h } from '../core/dom.js';
import { getItem, RES_TYPES, TIERS } from '../data/items.js';
import { branchItemIds, parentsOf } from '../data/barter.js';
import { explicitCost, buyBarterItem, countOwned, isUnlocked, nodeAvailable, ownedCount } from '../game/economy.js';
import { getState, mutate } from '../core/state.js';
import { fmt, fmtKg } from '../core/util.js';
import { statLine, rarityCss, rarityName } from './common.js';
import { openSheet, closeSheet } from './sheet.js';
import { toast } from './toast.js';

const NS = 'http://www.w3.org/2000/svg';
const NODE_W = 150, NODE_H = 66, COL_GAP = 44, ROW_GAP = 16, PAD = 6;
const COL_W = NODE_W + COL_GAP, ROW_H = NODE_H + ROW_GAP;

const svg = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'onclick') el.addEventListener('click', v);
    else if (k === 'onkeydown') el.addEventListener('keydown', v);
    else el.setAttribute(k, v);
  }
  kids.flat().forEach((c) => c != null && c !== false && el.append(c instanceof Node ? c : document.createTextNode(c)));
  return el;
};

// Раскладка: колонка = ступень, строка (линия) — продолжение родителя; вторая и следующие ветки идут на новые строки
function layout(rootId) {
  const ids = branchItemIds(rootId);
  const lane = { [rootId]: 0 };
  let nextLane = 1;
  const walk = (id) => {
    (getItem(id).next ?? []).forEach((n, i) => {
      if (lane[n] !== undefined) return;
      lane[n] = i === 0 ? lane[id] : nextLane++;
      walk(n);
    });
  };
  walk(rootId);
  const pos = {};
  for (const id of ids) pos[id] = { x: PAD + getItem(id).tier * COL_W, y: PAD + lane[id] * ROW_H };
  const cols = Math.max(...ids.map((id) => getItem(id).tier)) + 1;
  return { ids, pos, width: PAD * 2 + (cols - 1) * COL_W + NODE_W, height: PAD * 2 + nextLane * ROW_H - ROW_GAP };
}

const shortName = (name) => {
  const i = name.indexOf('«');
  return i > 0 ? [name.slice(0, i).trim(), name.slice(i)] : [name, ''];
};

export function branchTree(s, rootId) {
  const { ids, pos, width, height } = layout(rootId);
  const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, width, height, class: 'btree', role: 'group', 'aria-label': 'Дерево бартера' });

  // линии под карточками; линия «горит», когда вещь, в которую она ведёт, уже открыта
  for (const id of ids) for (const n of getItem(id).next ?? []) {
    const a = pos[id], b = pos[n];
    const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2, mx = (x1 + x2) / 2;
    root.append(svg('path', {
      d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`,
      class: 'btree-line' + (isUnlocked(s, n) ? ' lit' : isUnlocked(s, id) ? ' open' : ''),
    }));
  }

  for (const id of ids) {
    const d = getItem(id), p = pos[id];
    const have = isUnlocked(s, id), can = nodeAvailable(s, id);
    const st = have ? 'have' : can ? 'can' : 'locked';
    const [code, nick] = shortName(d.name);
    const cost = explicitCost(id);
    const open = () => openNode(id);
    const btnY = p.y + NODE_H - 22;
    root.append(svg('g', {
      class: `btree-node ${st}`, style: `--rc:${rarityCss(TIERS[d.tier])}`, tabindex: 0, role: 'button',
      'aria-label': d.name, onclick: open, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') open(); },
    },
      svg('rect', { class: 'card', x: p.x, y: p.y, width: NODE_W, height: NODE_H, rx: 3 }),
      svg('text', { x: p.x + 8, y: p.y + 17, class: 'n1' }, code),
      svg('text', { x: p.x + 8, y: p.y + 31, class: 'n2' }, nick || rarityName(TIERS[d.tier])),
      svg('rect', { class: 'btn', x: p.x + 8, y: btnY, width: NODE_W - 16, height: 16, rx: 2 }),
      svg('text', { x: p.x + NODE_W / 2, y: btnY + 12, class: 'n3', 'text-anchor': 'middle' },
        have ? '✓ Куплено' : can ? `Купить · ${fmt(cost.money)}` : '🔒 Закрыто')));
  }
  return h('div', { class: 'btree-wrap' },
    h('div', { class: 'btree-scroll' }, root),
    h('small', { class: 'muted' }, 'Тапни по вещи: статы, цена и кнопка «Купить». Вещь открывается, когда куплена предыдущая в дереве. Листай вправо.'));
}

function openNode(id) {
  const s = getState();
  const d = getItem(id);
  const have = isUnlocked(s, id), can = nodeAvailable(s, id);
  const cost = explicitCost(id);
  const rows = [
    { label: 'Монеты', have: s.wallet.money, need: cost.money },
    ...cost.resources.map((r) => ({ label: RES_TYPES[r.type].name, have: countOwned(s.stash, r.id), need: r.amount })),
  ];
  const enough = rows.every((r) => r.have >= r.need);
  const prev = parentsOf(id).map((p) => getItem(p).name).join(' или ');
  const owned = ownedCount(s, id);

  openSheet(d.name, h('div', null,
    h('small', { class: 'muted' }, `${rarityName(TIERS[d.tier])} · масса ${fmtKg(d.weight)} кг${owned ? ` · у тебя: ${owned}` : ''}`),
    h('p', null, statLine(d)),
    d.desc ? h('p', { class: 'muted' }, d.desc) : null,
    h('p', null, h('b', null, 'Цена')),
    h('div', { class: 'rows' }, rows.map((r) => h('div', { class: 'row' },
      h('div', { class: 'row-main' }, r.label),
      h('div', { class: 'row-act' }, h('small', { class: r.have >= r.need ? 'ok' : 'warn' }, `${fmt(r.have)} / ${fmt(r.need)}`))))),
    !can ? h('p', { class: 'muted' }, `Сначала купи: ${prev}.`) : null,
    h('div', { class: 'btn-row' },
      h('button', {
        class: 'btn primary', disabled: !can || !enough,
        onclick: () => {
          const r = mutate((st) => buyBarterItem(st, id));
          closeSheet();
          toast(r.ok ? `Куплено: ${d.name}. Лежит на складе` : r.msg, r.ok ? 'ok' : 'warn');
        },
      }, have ? 'Купить ещё' : 'Купить'))));
}
