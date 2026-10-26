// Покупка, продажа, бартер
import { getItem, GEAR_RESOURCES, RES_TYPES, resId, TIERS } from '../data/items.js';
import { isBarterItem } from '../data/barter.js';
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

// Бартер: первое (слабое) оружие/броня/рюкзак — за деньги, предмет попадает на склад
export function buyBarterItem(state, itemId) {
  if (!isBarterItem(itemId)) return fail('Этого нет в бартере');
  const d = getItem(itemId);
  if (state.wallet.money < d.price) return fail('Не хватает денег');
  state.wallet.money -= d.price;
  addToStash(state, { id: itemId, count: 1, tier: 0 });
  return { ok: true };
}

// Сколько экземпляров предмета есть у игрока (слоты + инвентарь + склад)
export function ownedCount(state, itemId) {
  let n = 0;
  for (const s of Object.values(state.slots)) if (s?.id === itemId) n++;
  for (const it of state.inventory) if (it.id === itemId) n += it.count;
  for (const it of state.stash) if (it.id === itemId) n += it.count;
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
  for (const slot of Object.keys(state.slots)) {
    const it = state.slots[slot];
    if (it?.id === itemId) return it;
  }
  let best = null;
  for (const it of state.stash) {
    if (it.id !== itemId) continue;
    if (!best || (it.tier ?? 0) > (best.tier ?? 0)) best = it;
  }
  return best;
}

export function upgradeBarterItem(state, itemId) {
  if (!isBarterItem(itemId)) return fail('Этого нет в бартере');
  const it = upgradeTarget(state, itemId);
  if (!it) return fail('Нужна хотя бы одна такая вещь — экипированная или на складе');
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
