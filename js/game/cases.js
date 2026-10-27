// Открытие донатных кейсов. Награда выбирается по весам; расчёт на клиенте, пока нет настоящих платежей.
import { getCase, SKINS, SKIN_DUPLICATE_REFUND } from '../data/cases.js';
import { grantReward } from './pass.js';

const fail = (msg) => ({ ok: false, msg });

export function pickDrop(drops, rnd = Math.random) {
  const total = drops.reduce((s, d) => s + d.weight, 0);
  let x = rnd() * total;
  for (const d of drops) { x -= d.weight; if (x < 0) return d; }
  return drops[drops.length - 1];
}

export function openCase(state, caseId, rnd = Math.random) {
  const c = getCase(caseId);
  if (!c) return fail('Нет такого кейса');
  if (state.wallet.chromogroniti < c.price) return fail('Не хватает хромогронитов');
  state.wallet.chromogroniti -= c.price;
  const reward = pickDrop(c.drops, rnd).reward;
  let refund = 0;
  if (reward.type === 'skin' && state.skins.includes(reward.id)) {
    refund = SKIN_DUPLICATE_REFUND;
    state.wallet.chromogroniti += refund;
  } else grantReward(state, reward);
  return { ok: true, reward, refund };
}

// Надеть / снять скин (на какую вещь — берём из описания скина)
export function toggleSkin(state, skinId) {
  const s = SKINS[skinId];
  if (!s || !state.skins.includes(skinId)) return fail('Скин не открыт');
  if (state.skinSel[s.for] === skinId) delete state.skinSel[s.for];
  else state.skinSel[s.for] = skinId;
  return { ok: true };
}
