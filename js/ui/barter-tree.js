// Дерево улучшений ветки бартера: узлы-предметы и линии между ними (SVG). Тап по узлу — шторка со статами и ценой.
import { h } from '../core/dom.js';
import { getItem, RES_TYPES, TIERS } from '../data/items.js';
import { branchItemIds } from '../data/barter.js';
import { explicitCost, upgradeBarterItem, countOwned } from '../game/economy.js';
import { getState, mutate } from '../core/state.js';
import { effectiveItem } from '../game/durability.js';
import { fmt, fmtKg } from '../core/util.js';
import { statLine, rarityCss, rarityName } from './common.js';
import { openSheet, closeSheet } from './sheet.js';
import { toast } from './toast.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 320, NODE_W = 132, NODE_H = 46, ROW = 70, TOP = 8;

const svg = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'onclick') el.addEventListener('click', v);
    else el.setAttribute(k, v);
  }
  kids.flat().forEach((c) => c && el.append(c instanceof Node ? c : document.createTextNode(c)));
  return el;
};

// Раскладка: строка = ступень, колонка — по порядку внутри ступени (на развилке два узла рядом)
function layout(rootId) {
  const ids = branchItemIds(rootId);
  const rows = {};
  for (const id of ids) (rows[getItem(id).tier] ??= []).push(id);
  const pos = {};
  for (const [tier, list] of Object.entries(rows)) {
    list.forEach((id, i) => {
      pos[id] = { x: ((i + 1) * W) / (list.length + 1), y: TOP + Number(tier) * ROW + NODE_H / 2, w: Math.min(NODE_W, W / (list.length + 1) - 8) };
    });
  }
  const parents = {};
  for (const id of ids) for (const n of getItem(id).next ?? []) (parents[n] ??= []).push(id);
  return { ids, pos, parents, height: TOP * 2 + (Math.max(...Object.keys(rows).map(Number)) + 1) * ROW - (ROW - NODE_H) };
}

// Предки текущего предмета (пройденный путь)
function ancestors(id, parents, out = new Set()) {
  for (const p of parents[id] ?? []) { out.add(p); ancestors(p, parents, out); }
  return out;
}

const shortName = (name) => {
  const i = name.indexOf('«');
  return i > 0 ? [name.slice(0, i).trim(), name.slice(i)] : [name, ''];
};

function nodeSheet(rootId, id, state) {
  const d = getItem(id);
  const cost = explicitCost(id);
  const ok = state.wallet.money >= cost.money && cost.resources.every((r) => countOwned(state.stash, r.id) >= r.amount);
  const lines = [
    `${fmt(cost.money)} монет`,
    ...cost.resources.map((r) => `${fmt(r.amount)}× ${RES_TYPES[r.type].name} (${fmt(countOwned(state.stash, r.id))}/${fmt(r.amount)})`),
  ];
  return { d, cost, ok, lines };
}

export function branchTree(s, rootId, target) {
  const { ids, pos, parents, height } = layout(rootId);
  const curId = target?.id ?? null;
  const done = curId ? ancestors(curId, parents) : new Set();
  const nextIds = new Set(curId ? getItem(curId).next ?? [] : []);
  const stateOf = (id) => (id === curId ? 'cur' : done.has(id) ? 'done' : nextIds.has(id) ? 'next' : (!curId && id === rootId) ? 'next' : 'locked');

  const root = svg('svg', { viewBox: `0 0 ${W} ${height}`, class: 'btree', role: 'img', 'aria-label': 'Дерево улучшений' });

  // линии под узлами; пройденная линия подсвечена
  for (const id of ids) for (const n of getItem(id).next ?? []) {
    const a = pos[id], b = pos[n];
    const lit = (id === curId && nextIds.has(n)) || (done.has(n) || n === curId);
    const mid = (a.y + NODE_H / 2 + b.y - NODE_H / 2) / 2;
    root.append(svg('path', {
      d: `M${a.x},${a.y + NODE_H / 2} C${a.x},${mid} ${b.x},${mid} ${b.x},${b.y - NODE_H / 2}`,
      class: 'btree-line' + (lit ? ' lit' : ''),
    }));
  }

  for (const id of ids) {
    const d = getItem(id), p = pos[id], st = stateOf(id);
    const [code, nick] = shortName(d.name);
    root.append(svg('g', {
      class: `btree-node ${st}`, style: `--rc:${rarityCss(TIERS[d.tier])}`, tabindex: 0, role: 'button',
      onclick: () => openNode(rootId, id, st),
    },
      svg('rect', { x: p.x - p.w / 2, y: p.y - NODE_H / 2, width: p.w, height: NODE_H, rx: 3 }),
      svg('text', { x: p.x, y: p.y - 4, class: 'n1', 'text-anchor': 'middle' }, code),
      svg('text', { x: p.x, y: p.y + 12, class: 'n2', 'text-anchor': 'middle' }, nick || rarityName(TIERS[d.tier]))));
  }
  return h('div', { class: 'btree-wrap' }, root,
    h('small', { class: 'muted' }, curId ? 'Тапни по ступени: статы и цена. Светлые линии — пройденный путь.' : 'Купи первую ступень, дальше дерево откроется. Тапни по ступени, чтобы посмотреть статы.'));
}

function openNode(rootId, id, st) {
  const s = getState();
  const { d, cost, ok, lines } = nodeSheet(rootId, id, s);
  const inst = [...Object.values(s.slots), ...s.stash].find((i) => i?.id === id);
  const shown = inst ? effectiveItem(inst) : d;
  const status = { cur: 'Сейчас у тебя эта ступень', done: 'Пройдено', next: 'Следующая ступень', locked: 'Дальше по дереву' }[st];
  openSheet(d.name, h('div', null,
    h('small', { class: 'muted' }, `${status} · ${rarityName(TIERS[d.tier])} · масса ${fmtKg(d.weight)} кг`),
    h('p', null, statLine(shown)),
    d.desc ? h('p', { class: 'muted' }, d.desc) : null,
    st === 'cur' || st === 'done' ? null : h('p', null, h('b', null, 'Цена: '), lines.join(' · ')),
    st === 'next' && s && !(d.tier === 0) ? h('div', { class: 'btn-row' },
      h('button', {
        class: 'btn primary', disabled: !ok,
        onclick: () => {
          const r = mutate((state) => upgradeBarterItem(state, rootId, id));
          closeSheet();
          toast(r.ok ? `Улучшено: ${d.name}` : r.msg, r.ok ? 'ok' : 'warn');
        },
      }, ok ? 'Улучшить' : 'Не хватает ресурсов')) : null));
}
