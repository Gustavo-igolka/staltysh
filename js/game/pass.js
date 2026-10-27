// Получение наград боевого пропуска
import { PASS_REWARDS, passProgress } from '../data/pass.js';
import { addToStash } from './inventory.js';
import { getItem } from '../data/items.js';

const fail = (msg) => ({ ok: false, msg });

// Выдача награды (боевой пропуск, донатные кейсы): деньги, предмет на склад, купон, скин
export function grantReward(state, r) {
  if (r.type === 'money') state.wallet.money += r.amount;
  else if (r.type === 'item') addToStash(state, { id: r.id, count: r.count, tier: getItem(r.id).tier ?? 0 });
  else if (r.type === 'coupon') state.pass.coupons.push({ rarity: r.rarity, percent: r.percent });
  else if (r.type === 'skin' && !state.skins.includes(r.id)) state.skins.push(r.id);
}

export function claimPassReward(state, level) {
  const { level: cur } = passProgress(state.pass.xp);
  if (level < 1 || level > PASS_REWARDS.length) return fail('Нет такого уровня');
  if (level > cur) return fail('Уровень ещё не достигнут');
  if (state.pass.claimed.includes(level)) return fail('Награда уже получена');

  const r = PASS_REWARDS[level - 1];
  grantReward(state, r);
  state.pass.claimed.push(level);
  return { ok: true, reward: r };
}
