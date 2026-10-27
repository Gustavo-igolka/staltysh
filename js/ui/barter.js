import { h } from '../core/dom.js';
import { getState, mutate } from '../core/state.js';
import { getItem, RARITY, RES_TYPES, GEAR_RESOURCES, TIERS } from '../data/items.js';
import { BARTER_TABS, isExplicitBranch } from '../data/barter.js';
import { buyBarterItem, ownedCount, upgradeTarget, upgradeCost, upgradeBarterItem, countOwned, explicitCost, nextOptions } from '../game/economy.js';
import { effectiveItem } from '../game/durability.js';
import { fmt, fmtKg } from '../core/util.js';
import { chips, statLine, rarityCss, rarityName, tierPips, refresh } from './common.js';
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
    ...(section.note ? [h('p', { class: 'note' }, section.note)] : []),
    ...section.branches.map((b) => branchCard(s, b)));
}

const costText = (s, cost) => [
  `${fmt(cost.money)} монет`,
  ...cost.resources.map((r) => `${fmt(r.amount)}× ${RES_TYPES[r.type].name} (${fmt(countOwned(s.stash, r.id))}/${fmt(r.amount)})`),
].join(' · ');
const canPayCost = (s, cost) => s.wallet.money >= cost.money && cost.resources.every((r) => countOwned(s.stash, r.id) >= r.amount);

function branchCard(s, branch) {
  const id = branch.chain[0];
  const base = getItem(id);
  const buyCost = base.fixedTier ? explicitCost(id) : { money: base.price, resources: [] };
  const owned = ownedCount(s, id);
  const target = upgradeTarget(s, id); // экипированная вещь или лучшая копия на складе — то, что апгрейдится
  const tier = target ? (target.tier ?? 0) : null;
  const d = target ? effectiveItem(target) : base; // показываем статы с учётом ступени, если вещь уже есть
  const maxed = tier !== null && tier >= TIERS.length - 1;

  return h('section', { class: 'panel branch' },
    h('h3', { class: 'panel-title' }, `Ветка «${branch.name}»`),
    h('div', { class: 'row' },
      h('div', { class: 'row-main' },
        h('b', null, d.name, tier !== null ? h('small', null, ` · ${rarityName(TIERS[tier])}`) : null),
        h('small', null, [statLine(d), `масса ${fmtKg(d.weight)} кг`, owned ? `у тебя: ${owned}` : null].filter(Boolean).join(' · ')),
        h('small', { class: 'desc' }, d.desc)),
      h('div', { class: 'row-act' },
        h('button', {
          class: 'btn small primary', disabled: !canPayCost(s, buyCost),
          onclick: () => {
            const r = mutate((st) => buyBarterItem(st, id));
            toast(r.ok ? `Куплено: ${base.name}. Предмет лежит на складе` : r.msg, r.ok ? 'ok' : 'warn');
          },
        }, buyCost.resources.length ? 'Купить' : `Купить · ${fmt(buyCost.money)}`))),
    ...(buyCost.resources.length ? [h('small', { class: 'cost' }, `Цена: ${costText(s, buyCost)}`)] : []),
    h('div', { class: 'ladder' },
      tierPips(tier ?? -1),
      upgradeRow(s, id, target, tier, maxed)));
}

function upgradeRow(s, id, target, tier, maxed) {
  if (target && isExplicitBranch(id)) return explicitUpgradeRow(s, id, target, tier);
  if (!target) return h('small', null, 'Купи первую (серую) ступень — дальше её можно улучшать на складе бартерными ресурсами.');
  if (maxed) return h('small', null, 'Максимальная ступень достигнута.');
  const nextTier = tier + 1;
  const cost = upgradeCost(id, nextTier);
  const haveMoney = s.wallet.money >= cost.money;
  const missing = cost.resources.filter((r) => countOwned(s.stash, r.id) < r.amount);
  const canAfford = haveMoney && missing.length === 0;
  const costText = [`${fmt(cost.money)} монет`, ...cost.resources.map((r) => `${r.amount}× ${RES_TYPES[r.type].name} (${countOwned(s.stash, r.id)}/${r.amount})`)].join(' · ');
  return h('div', { class: 'upgrade-row' },
    h('small', null, `До ступени «${rarityName(TIERS[nextTier])}»: ${costText}`),
    h('button', {
      class: 'btn small ghost', disabled: !canAfford,
      onclick: () => {
        const r = mutate((st) => upgradeBarterItem(st, id));
        toast(r.ok ? `Улучшено до ступени «${rarityName(TIERS[r.tier])}»` : r.msg, r.ok ? 'ok' : 'warn');
      },
    }, 'Улучшить'));
}

// Ветка с отдельным предметом на каждой ступени: показываем, во что превратится вещь и сколько это стоит.
// На развилке (Атлас / Оракул) кнопок две.
function explicitUpgradeRow(s, rootId, target, tier) {
  const options = nextOptions(target);
  if (!options.length) return h('small', null, 'Максимальная ступень достигнута.');
  return h('div', { class: 'upgrade-row fork' },
    ...options.map((nid) => {
      const nd = getItem(nid);
      const cost = explicitCost(nid);
      return h('div', { class: 'upgrade-opt' },
        h('small', null, `→ ${nd.name} (${rarityName(TIERS[nd.tier])}): ${costText(s, cost)}`),
        h('small', { class: 'desc' }, statLine(nd)),
        h('button', {
          class: 'btn small ghost', disabled: !canPayCost(s, cost),
          onclick: () => {
            const r = mutate((st) => upgradeBarterItem(st, rootId, nid));
            toast(r.ok ? `Улучшено: ${nd.name}` : r.msg, r.ok ? 'ok' : 'warn');
          },
        }, options.length > 1 ? `Улучшить → ${nd.name.split('«')[1]?.replace('»', '') ?? nd.name}` : 'Улучшить'));
    }));
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
