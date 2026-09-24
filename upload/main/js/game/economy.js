// Покупка, продажа, бартер
import { getItem } from '../data/items.js';
import { isBarterItem } from '../data/barter.js';
import { addToInventory, addToStash } from './inventory.js';
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
