// Общие кусочки интерфейса
import { h } from '../core/dom.js';
import { emit } from '../core/events.js';
import { getItem, RARITY, TIERS } from '../data/items.js';
import { armorStatItems, weaponStatItems, bagStatItems } from '../data/player.js';
import { hasDurability, durCur, durMax, isBroken } from '../game/durability.js';

export const refresh = () => emit('ui:refresh');
export const goto = (screenId) => emit('nav', screenId);

const GEAR = ['weapon', 'secondary', 'armor', 'backpack'];

// Цвет редкости конкретного предмета: у снаряжения зависит от ступени улучшения, у ресурсов — своя
export function rarityKey(it) {
  const d = getItem(it.id);
  if (d.type === 'resource') return d.rarity;
  if (GEAR.includes(d.type)) return TIERS[it.tier ?? 0] ?? 'grey';
  return 'grey';
}
export const rarityCss = (key) => (RARITY[key] ?? RARITY.grey).css;
export const rarityName = (key) => (RARITY[key] ?? RARITY.grey).name;

// Короткая строка характеристик для списков
export function statLine(d) {
  const line = (items) => items.map(([l, v]) => `${l} ${v}`).join(' · ');
  if (d.type === 'weapon' || d.type === 'secondary') return line(weaponStatItems(d.stats, true));
  if (d.type === 'armor') return line(armorStatItems(d.stats, true));
  if (d.type === 'backpack') return line(bagStatItems(d, true));
  if (d.heal) return `Лечит ${d.heal}`;
  return '';
}

// Полный список [подпись, значение] для окна предмета
export function statItems(d) {
  if (d.type === 'weapon' || d.type === 'secondary') return weaponStatItems(d.stats);
  if (d.type === 'armor') return armorStatItems(d.stats);
  if (d.type === 'backpack') return bagStatItems(d);
  return [];
}

export const durLabel = (it) => (hasDurability(it) ? `${Math.round(durCur(it))} / ${durMax(it)}` : '');
export { isBroken, hasDurability };

// Ряд из 7 отметок: закрашены ступени до текущей
export function tierPips(tier = -1) {
  return h('span', { class: 'pips', title: 'Ступени улучшения' },
    TIERS.map((r, i) => h('i', { class: i <= tier ? 'on' : '', style: { '--rc': rarityCss(r) } })));
}

export function section(title, ...children) {
  return h('section', { class: 'panel' }, title ? h('h3', { class: 'panel-title' }, title) : null, ...children);
}

export function emptyState(title, text) {
  return h('div', { class: 'empty' }, h('b', null, title), text ? h('p', null, text) : null);
}

// Переключатель-вкладки: options = [[value, label], ...]
export function chips(options, current, onPick) {
  return h('div', { class: 'chips' }, options.map(([v, label]) =>
    h('button', { class: 'chip' + (v === current ? ' active' : ''), onclick: () => onPick(v) }, label)));
}

export function toggle(label, value, onChange) {
  return h('button', { class: 'toggle' + (value ? ' on' : ''), role: 'switch', 'aria-checked': String(!!value), onclick: () => onChange(!value) },
    h('span', null, label), h('i'));
}
