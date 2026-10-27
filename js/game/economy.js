// Покупка, продажа, бартер
import { getItem, GEAR_RESOURCES, RES_TYPES, resId, TIERS } from '../data/items.js';
import { isBarterItem, branchItemIds, isExplicitBranch } from '../data/barter.js';
import { RES_ORDER } from '../data/armor.js';
import { addToInventory, addToStash } from './inventory.js';
import { durMax as tieredDurMax } from './durability.js';
import { clamp } from '../core/util.js';

const fail = (msg) => ({ ok: false, msg });

// Магазин: покупка идёт в инвентарь, что не влезло — на склад
export function buyItem(state, itemId, qty = 1) {
  const d = getItem(itemId);
  if (!d.price) return fail('Этот предмет не продаётся');
  const cost = d.price * qty;
  if (state.wallet.money < cost) return fail('Не хватает денег');
  const toInv = addToInventory(state, { id: itemId, count: qty, tier: 0 });
  const toStash = qty - toInv;
  if (toStash > 0) addToStash(state, { id: itemId, count: toStash, tier: 0 });
  state.wallet.money -= cost;
  return { ok: true, toInv, toStash, cost };
}

// Продажа из инвентаря ('inventory') или со склада ('stash'); продаётся только то, у чего есть цена продажи
export function sellItem(state, from, itemUid, qty) {
  const list = state[from];
  const it = list?.find((i) => i.uid === itemUid);
  if (!it) return fail('Предмет не найден');
  const d = getItem(it.id);
  if (!d.sell) return fail('Это нельзя продать');
  const n = clamp(qty ?? it.count, 1, it.count);
  state.wallet.money += d.sell * n;
  it.count -= n;
  if (it.count <= 0) list.splice(list.indexOf(it), 1);
  return { ok: true, gained: d.sell * n };
}

export function junkValue(state, from) {
  return state[from].reduce((s, it) => {
    const d = getItem(it.id);
    return s + (d.type === 'junk' ? d.sell * it.count : 0);
  }, 0);
}

export function sellAllJunk(state, from) {
  let gained = 0;
  state[from] = state[from].filter((it) => {
    const d = getItem(it.id);
    if (d.type !== 'junk') return true;
    gained += d.sell * it.count;
    return false;
  });
  if (!gained) return fail('Хлама нет');
  state.wallet.money += gained;
  return { ok: true, gained };
}

// Ресурсы вещи с явными ступенями: ступень рассчитывается из общего числа и весов цепочки (data/armor.js).
// Типов, которых на этой редкости ещё нет в игре (прикопы — от синей, разломы — от фиолетовой), доля уходит остальным.
export function explicitCost(itemId) {
  const c = getItem(itemId).cost;
  if (!c) return { money: getItem(itemId).price ?? 0, resources: [] };
  if (!c.weights) return { money: c.money, resources: [] };
  const tier = getItem(itemId).tier;
  const rarity = TIERS[tier];
  const avail = RES_ORDER.map((t, i) => (GEAR_RESOURCES[rarity].includes(t) ? i : -1)).filter((i) => i >= 0);
  let amounts;
  if (c.total === null) amounts = c.weights.slice(); // красный рецепт — готовые числа
  else {
    const sum = avail.reduce((a, i) => a + c.weights[i], 0);
    const raw = c.weights.map((w, i) => (avail.includes(i) ? (c.total * w) / sum : 0));
    amounts = raw.map(Math.floor);
    let left = c.total - amounts.reduce((a, b) => a + b, 0);
    // остаток — самым большим дробным частям
    const order = raw.map((v, i) => [v - Math.floor(v), i]).filter(([, i]) => avail.includes(i)).sort((a, b) => b[0] - a[0]);
    for (let k = 0; left > 0; k = (k + 1) % order.length, left--) amounts[order[k][1]]++;
  }
  return {
    money: c.money,
    resources: RES_ORDER.map((type, i) => ({ type, id: resId(type, rarity), amount: amounts[i] })).filter((r) => r.amount > 0),
  };
}

function canPay(state, cost) {
  if (state.wallet.money < cost.money) return 'Не хватает денег';
  for (const r of cost.resources) {
    if (countOwned(state.stash, r.id) < r.amount) return `Не хватает ресурса «${RES_TYPES[r.type].name}»`;
  }
  return null;
}
function pay(state, cost) {
  state.wallet.money -= cost.money;
  for (const r of cost.resources) removeFromList(state.stash, r.id, r.amount);
}

// Бартер: первая вещь ветки (или красная прямой покупки) — деньги (+ ресурсы у красных), предмет попадает на склад
export function buyBarterItem(state, itemId) {
  if (!isBarterItem(itemId)) return fail('Этого нет в бартере');
  const d = getItem(itemId);
  const cost = d.fixedTier ? explicitCost(itemId) : { money: d.price, resources: [] };
  const why = canPay(state, cost);
  if (why) return fail(why);
  pay(state, cost);
  addToStash(state, { id: itemId, count: 1, tier: d.tier ?? 0 });
  return { ok: true };
}

// Сколько экземпляров предмета есть у игрока (слоты + инвентарь + склад)
export function ownedCount(state, itemId) {
  const ids = isExplicitBranch(itemId) ? branchItemIds(itemId) : [itemId];
  let n = 0;
  for (const s of Object.values(state.slots)) if (s && ids.includes(s.id)) n++;
  for (const it of state.inventory) if (ids.includes(it.id)) n += it.count;
  for (const it of state.stash) if (ids.includes(it.id)) n += it.count;
  return n;
}

// ── Углублённый бартер: апгрейд вещи по ступеням (0..6 — см. TIERS в data/items.js) ──────────────
// Это СИСТЕМА апгрейда, не финальный баланс: конкретные числа (цена, объём ресурсов) — черновые,
// их предстоит подогнать отдельно вместе с балансировкой экономики. Апгрейд тратит деньги + все типы
// бартерных ресурсов нужной редкости (GEAR_RESOURCES) со склада — растущими объёмами по мере ступени.
export function upgradeCost(baseItemId, tier) {
  const d = getItem(baseItemId);
  const rarity = TIERS[tier];
  const amount = 3 * tier; // черновая прогрессия: 3 на 1-ю ступень апгрейда, 6 на 2-ю, ... 18 на 6-ю
  return {
    money: Math.round(d.price * 0.5 * tier),
    resources: (GEAR_RESOURCES[rarity] ?? []).map((type) => ({ type, id: resId(type, rarity), amount })),
  };
}

export const countOwned = (list, id) => list.reduce((s, it) => s + (it.id === id ? it.count : 0), 0);

function removeFromList(list, id, n) {
  let left = n;
  for (const it of [...list]) {
    if (left <= 0) break;
    if (it.id !== id) continue;
    const k = Math.min(left, it.count);
    it.count -= k; left -= k;
    if (it.count <= 0) list.splice(list.indexOf(it), 1);
  }
}

// Экземпляр вещи, который будет улучшен: сначала экипированный (если это та же вещь), иначе лучшая
// по ступени копия на складе. Инвентарь вылазки не трогаем — бартер доступен только из бункера.
export function upgradeTarget(state, itemId) {
  const ids = isExplicitBranch(itemId) ? branchItemIds(itemId) : [itemId];
  for (const slot of Object.keys(state.slots)) {
    const it = state.slots[slot];
    if (it && ids.includes(it.id)) return it;
  }
  let best = null;
  for (const it of state.stash) {
    if (!ids.includes(it.id)) continue;
    if (!best || (it.tier ?? 0) > (best.tier ?? 0)) best = it;
  }
  return best;
}

// Варианты улучшения вещи с явными ступенями: один следующий предмет, на развилке — два
export const nextOptions = (it) => (it ? getItem(it.id).next ?? [] : []);

// Улучшение вещи с явными ступенями: старый экземпляр заменяется следующим предметом цепочки
function upgradeExplicit(state, it, nextId) {
  const options = nextOptions(it);
  if (!options.length) return fail('Уже максимальная ступень');
  const target = nextId ?? options[0];
  if (!options.includes(target)) return fail('Сюда улучшить нельзя');
  const cost = explicitCost(target);
  const why = canPay(state, cost);
  if (why) return fail(why);
  pay(state, cost);
  const nd = getItem(target);
  it.id = target;
  it.tier = nd.tier;
  it.dur = tieredDurMax(it); // новая вещь — целая
  return { ok: true, tier: nd.tier, id: target };
}

export function upgradeBarterItem(state, itemId, nextId) {
  if (!isBarterItem(itemId)) return fail('Этого нет в бартере');
  const it = upgradeTarget(state, itemId);
  if (!it) return fail('Нужна хотя бы одна такая вещь — экипированная или на складе');
  if (isExplicitBranch(itemId)) return upgradeExplicit(state, it, nextId);
  const tier = it.tier ?? 0;
  if (tier >= TIERS.length - 1) return fail('Уже максимальная ступень');
  const nextTier = tier + 1;
  const cost = upgradeCost(itemId, nextTier);
  if (state.wallet.money < cost.money) return fail('Не хватает денег');
  for (const r of cost.resources) {
    if (countOwned(state.stash, r.id) < r.amount) return fail(`Не хватает ресурса «${RES_TYPES[r.type].name}»`);
  }
  state.wallet.money -= cost.money;
  for (const r of cost.resources) removeFromList(state.stash, r.id, r.amount);
  it.tier = nextTier;
  it.dur = tieredDurMax(it); // апгрейд заодно полностью чинит вещь
  return { ok: true, tier: nextTier };
}
