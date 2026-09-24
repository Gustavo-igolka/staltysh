import { h } from '../core/dom.js';
import { getState, mutate } from '../core/state.js';
import { getItem, TYPE_NAMES, categoryOf } from '../data/items.js';
import { getGrid, totalWeight, moveToInventory, moveToStash, equip, unequip } from '../game/inventory.js';
import { fmtKg } from '../core/util.js';
import { ARMOR_CLASSES } from '../data/player.js';
import { computeStats, blockedZoneLevel } from '../game/stats.js';
import { section, chips, emptyState, rarityKey, rarityCss, rarityName, statItems, tierPips, refresh, durLabel, isBroken, hasDurability } from './common.js';
import { openSheet, closeSheet } from './sheet.js';
import { toast } from './toast.js';

const SLOT_LABELS = { weapon: 'Оружие', secondary: 'Доп. оружие', armor: 'Броня', backpack: 'Рюкзак / контейнер' };
const FILTERS = [['all', 'Всё'], ['gear', 'Снаряжение'], ['consumable', 'Расходники'], ['resource', 'Ресурсы'], ['junk', 'Хлам']];
let filter = 'all';

export function renderInventory(root) {
  const s = getState();
  const grid = getGrid(s);
  const weight = totalWeight(s.inventory);
  const pct = Math.min(100, (weight / grid.maxWeight) * 100);

  const slots = h('div', { class: 'slots' }, Object.keys(SLOT_LABELS).map((k) => {
    const it = s.slots[k];
    const d = it && getItem(it.id);
    return h('button', {
      class: 'slot' + (it ? ' filled' : '') + (it && isBroken(it) ? ' broken' : ''),
      style: it ? { '--rc': rarityCss(rarityKey(it)) } : null,
      onclick: () => (it ? openItemSheet(it, 'slot', k) : toast('Слот пуст. Открой предмет на складе и нажми «Экипировать»')),
    }, h('small', null, SLOT_LABELS[k]), h('b', null, d ? d.name : 'Пусто'),
      it && hasDurability(it) ? h('small', { class: 'dur' }, isBroken(it) ? 'Сломано' : `Прочность ${durLabel(it)}`) : null,
      it ? tierPips(it.tier ?? 0) : null);
  }));

  const inv = h('div', null,
    h('div', { class: 'weight' },
      h('div', { class: 'bar' + (pct > 90 ? ' warn' : '') }, h('i', { style: { width: `${pct}%` } })),
      h('span', null, `${fmtKg(weight)} / ${fmtKg(grid.maxWeight)} кг`)),
    h('div', { class: 'igrid', style: { '--cols': grid.w, '--rows': grid.h } },
      s.inventory.map((it) => {
        const d = getItem(it.id);
        return h('button', {
          class: 'icell',
          style: { gridColumn: `${it.x + 1} / span ${d.w}`, gridRow: `${it.y + 1} / span ${d.h}`, '--rc': rarityCss(rarityKey(it)) },
          onclick: () => openItemSheet(it, 'inventory'),
        }, h('span', null, d.name), it.count > 1 ? h('em', null, `×${it.count}`) : null);
      })),
    s.inventory.length ? null : h('p', { class: 'muted' }, 'Инвентарь пуст. Сюда попадает всё, что ты берёшь с собой в открытый мир.'));

  const items = s.stash
    .filter((i) => filter === 'all' || categoryOf(getItem(i.id)) === filter)
    .sort((a, b) => getItem(a.id).name.localeCompare(getItem(b.id).name, 'ru'));

  const stash = h('div', null,
    chips(FILTERS, filter, (v) => { filter = v; refresh(); }),
    items.length
      ? h('div', { class: 'stash' }, items.map((it) => {
          const d = getItem(it.id);
          return h('button', { class: 'tile', style: { '--rc': rarityCss(rarityKey(it)) }, onclick: () => openItemSheet(it, 'stash') },
            h('b', null, d.name),
            h('small', null, TYPE_NAMES[d.type] + (it.count > 1 ? ` ×${it.count}` : '') + (isBroken(it) ? ' · сломано' : '')));
        }))
      : emptyState('Здесь пусто', 'Всё, что ты купишь или найдёшь, хранится на складе бункера.'));

  root.append(
    h('h2', { class: 'screen-title' }, 'Инвентарь'),
    section('Персонаж', slots),
    statsPanel(s),
    section('Инвентарь вылазки', inv),
    section('Склад бункера', stash));
}

function statsPanel(s) {
  const st = computeStats(s);
  const zone = (p) => (p >= 100 ? `${p} · зоны до ${blockedZoneLevel(p)} ур.` : String(p));
  const rows = [
    ['Здоровье', st.health],
    ['Живучесть', `${st.survivability}%`],
    ['Скорость', `${st.speed}%`],
    ['Запас против пуль', st.pools.bullet],
    ['Запас против разрыва', st.pools.tear],
    ['Запас против взрыва', st.pools.blast],
    ['Защита от радиации', zone(st.rad)],
    ['Защита от биозаражения', zone(st.bio)],
    ['Защита от пси-излучения', zone(st.psi)],
    ['Защита от температуры', st.temp],
    ['Защита от кровотечения', `${st.bleedProt}%`],
    ['Вывод кровотечения', `${st.bleedRemoval}%`],
    ['Регенерация', `${st.regen.rate}%/с через ${st.regen.delay} с после ранения`],
    ['Периодическое лечение', `${st.regen.periodic}%`],
    ['Переносимый вес', `${fmtKg(st.carry)} кг`],
  ];
  return h('details', { class: 'panel stats-panel' },
    h('summary', null, 'Характеристики персонажа'),
    h('dl', { class: 'statgrid' }, rows.map(([k, v]) => h('div', { class: 'statrow' }, h('dt', null, k), h('dd', null, String(v))))),
    h('p', { class: 'muted small' }, 'Запас = (здоровье + защита) × живучесть: столько урона нужно получить до смерти. Кровотечение останавливает регенерацию.'));
}

function openItemSheet(it, where, slotKey) {
  const d = getItem(it.id);
  const key = rarityKey(it);
  let qty = it.count;
  const qtyEl = h('b', { class: 'qty-val' }, String(qty));
  const setQty = (v) => { qty = Math.max(1, Math.min(it.count, v)); qtyEl.textContent = String(qty); };

  const done = (res) => {
    if (!res.ok) toast(res.msg, 'warn');
    else closeSheet();
  };

  const actions = [];
  if (where === 'stash') {
    actions.push(h('button', { class: 'btn primary', onclick: () => done(mutate((st) => moveToInventory(st, it.uid, qty))) }, 'В инвентарь'));
    if (d.slot) actions.push(h('button', { class: 'btn ghost', onclick: () => done(mutate((st) => equip(st, 'stash', it.uid))) }, 'Экипировать'));
  } else if (where === 'inventory') {
    actions.push(h('button', { class: 'btn primary', onclick: () => done(mutate((st) => moveToStash(st, it.uid, qty))) }, 'На склад'));
    if (d.slot) actions.push(h('button', { class: 'btn ghost', onclick: () => done(mutate((st) => equip(st, 'inventory', it.uid))) }, 'Экипировать'));
  } else {
    actions.push(h('button', { class: 'btn primary', onclick: () => done(mutate((st) => unequip(st, slotKey))) }, 'Снять'));
  }

  openSheet(d.name, h('div', { class: 'item-sheet' },
    h('p', { class: 'kind', style: { '--rc': rarityCss(key) } },
      `${TYPE_NAMES[d.type]}${d.armorClass ? ` · ${ARMOR_CLASSES[d.armorClass]}` : ''}${key !== 'grey' || d.type === 'resource' || d.slot ? ` · ${rarityName(key)}` : ''}`),
    d.desc ? h('p', null, d.desc) : null,
    statItems(d).length
      ? h('ul', { class: 'statlist' }, statItems(d).map(([l, v]) => h('li', null, h('span', null, l), h('b', null, v))))
      : null,
    hasDurability(it) ? durability(it, d) : null,
    d.ammo ? h('p', { class: 'muted' }, `Патроны: ${getItem(d.ammo).name}`) : null,
    h('p', { class: 'muted' }, `Вес ${fmtKg(d.weight)} кг · размер ${d.w}×${d.h}${it.count > 1 ? ` · всего ${it.count}` : ''}`),
    where !== 'slot' && it.count > 1
      ? h('div', { class: 'stepper' },
          h('button', { onclick: () => setQty(qty - 1) }, '−'), qtyEl,
          h('button', { onclick: () => setQty(qty + 1) }, '+'),
          h('button', { onclick: () => setQty(it.count) }, 'Все'))
      : null,
    h('div', { class: 'btn-row' }, actions)));
}

function durability(it, d) {
  const broken = isBroken(it);
  const cur = it.dur ?? d.durMax;
  return h('div', { class: 'durability' + (broken ? ' broken' : '') },
    h('div', { class: 'weight' },
      h('div', { class: 'bar' + (broken ? ' warn' : '') }, h('i', { style: { width: `${Math.max(0, Math.min(100, (cur / d.durMax) * 100))}%` } })),
      h('span', null, `Прочность ${durLabel(it)}`)),
    broken
      ? h('p', { class: 'warn-text' }, d.type === 'armor'
          ? 'Сломано: броня не даёт характеристик и лежит мёртвым грузом. Ремонт появится позже.'
          : 'Сломано: оружие клинит, заклинивание снимается только полной перезарядкой. Ремонт появится позже.')
      : null);
}
