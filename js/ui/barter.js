import { h } from '../core/dom.js';
import { getState, mutate } from '../core/state.js';
import { getItem, RARITY, RES_TYPES, GEAR_RESOURCES } from '../data/items.js';
import { BARTER_TABS } from '../data/barter.js';
import { buyBarterItem, ownedCount } from '../game/economy.js';
import { fmt, fmtKg } from '../core/util.js';
import { chips, statLine, rarityCss, tierPips, refresh } from './common.js';
import { openSheet } from './sheet.js';
import { toast } from './toast.js';

let tabId = 'weapon';
const sectionByTab = {}; // запоминаем подраздел в каждой вкладке

export function renderBarter(root) {
  const s = getState();
  const tab = BARTER_TABS.find((t) => t.id === tabId) ?? BARTER_TABS[0];
  const section = tab.sections.find((x) => x.id === sectionByTab[tab.id]) ?? tab.sections[0];

  root.append(
    h('h2', { class: 'screen-title' }, 'Бартер'),
    h('p', { class: 'muted' }, 'Первое слабое оружие, броня и сумка покупаются за деньги. Дальше вещь улучшается: старая вещь + деньги + бартерные ресурсы нужной редкости.'),
    h('button', { class: 'btn small ghost', onclick: showResources }, 'Бартерные ресурсы'),
    chips(BARTER_TABS.map((t) => [t.id, t.name]), tab.id, (v) => { tabId = v; refresh(); }),
    chips(tab.sections.map((x) => [x.id, x.name]), section.id, (v) => { sectionByTab[tab.id] = v; refresh(); }),
    section.note ? h('p', { class: 'note' }, section.note) : null,
    ...section.branches.map((b) => branchCard(s, b)));
}

function branchCard(s, branch) {
  const id = branch.chain[0];
  const d = getItem(id);
  const owned = ownedCount(s, id);
  return h('section', { class: 'panel branch' },
    h('h3', { class: 'panel-title' }, `Ветка «${branch.name}»`),
    h('div', { class: 'row' },
      h('div', { class: 'row-main' },
        h('b', null, d.name),
        h('small', null, [statLine(d), `масса ${fmtKg(d.weight)} кг`, owned ? `у тебя: ${owned}` : null].filter(Boolean).join(' · ')),
        h('small', { class: 'desc' }, d.desc)),
      h('div', { class: 'row-act' },
        h('button', {
          class: 'btn small primary', disabled: s.wallet.money < d.price,
          onclick: () => {
            const r = mutate((st) => buyBarterItem(st, id));
            toast(r.ok ? `Куплено: ${d.name}. Предмет лежит на складе` : r.msg, r.ok ? 'ok' : 'warn');
          },
        }, `Купить · ${fmt(d.price)}`))),
    h('div', { class: 'ladder' },
      tierPips(0),
      h('small', null, 'Улучшения по ступеням появятся на этапе «углублённый бартер»')));
}

function showResources() {
  const tiers = ['grey', 'blue', 'purple', 'red'];
  const gear = { grey: 'Серые вещи', blue: 'Синие вещи', purple: 'Фиолетовые вещи', red: 'Красные вещи' };
  openSheet('Бартерные ресурсы', h('div', null,
    h('p', { class: 'muted' }, 'У каждого ресурса есть редкость. Чем дальше от бункера, тем реже добыча. Вещь определённой редкости требует ресурсы той же редкости.'),
    ...Object.values(RES_TYPES).map((t) => h('div', { class: 'res' },
      h('b', null, t.name),
      h('small', null, `${t.source}${t.needs ? ` · нужен предмет: ${getItem(t.needs).name}` : ''}`),
      h('span', { class: 'pips' }, tiers.map((r) => h('i', { class: t.rarities.includes(r) ? 'on' : '', style: { '--rc': rarityCss(r) }, title: RARITY[r].name }))))),
    h('h3', { class: 'panel-title sheet-sub' }, 'Что нужно для вещей'),
    ...tiers.map((r) => h('div', { class: 'res' },
      h('b', { style: { color: rarityCss(r) } }, gear[r]),
      h('small', null, GEAR_RESOURCES[r].map((k) => RES_TYPES[k].name).join(', '))))));
}
