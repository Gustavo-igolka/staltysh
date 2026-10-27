// Донатные кейсы (за хромогрониты). Принцип боевого пропуска: донат — только расходники и косметика,
// никаких вещей с силой. Скины статы не меняют. Шансы (weight) правятся здесь.
import { BP1_ARMOR_ID } from './armor.js';

const money = (amount) => ({ type: 'money', amount });
const item = (id, count) => ({ type: 'item', id, count });
const coupon = (rarity, percent) => ({ type: 'coupon', rarity, percent });
const skin = (id) => ({ type: 'skin', id });

// Скины: for — к какой вещи подходит. Сами картинки появятся позже, пока скин — название и отметка «надет».
export const SKINS = {
  ryvok_city:   { id: 'ryvok_city',   name: '«Городской Xizus»', for: BP1_ARMOR_ID, desc: 'Тёмная городская расцветка корпоративного штурмовика.' },
  ryvok_parade: { id: 'ryvok_parade', name: '«Парадный белый»',  for: BP1_ARMOR_ID, desc: 'Белый парадный комплект Xizus. В Зоне долго не остаётся белым.' },
};

// Если скин уже есть — вместо него возвращаем часть цены хромогронитами
export const SKIN_DUPLICATE_REFUND = 30;

export const CASES = [
  { id: 'supply', name: 'Контейнер снабжения Xizus', price: 40, desc: 'Расходники из тех, что раздают по контрактам Операции «Прорыв»: аптечки, установки, патроны, деньги, скидки.',
    drops: [
      { weight: 24, reward: money(1500) },
      { weight: 16, reward: item('medkit', 5) },
      { weight: 14, reward: item('bandage', 10) },
      { weight: 12, reward: item('ammo_ar', 120) },
      { weight: 8,  reward: item('ammo_sniper', 60) },
      { weight: 8,  reward: item('anomaly_install', 1) },
      { weight: 5,  reward: item('metal_detector', 1) },
      { weight: 6,  reward: coupon('grey', 10) },
      { weight: 4,  reward: coupon('blue', 15) },
      { weight: 2,  reward: coupon('purple', 20) },
      { weight: 1,  reward: money(10000) },
    ] },
  { id: 'skins', name: 'Кейс «Лицо корпорации»', price: 120, desc: 'Только косметика для «Рывка». Повторный скин возвращает часть цены. Статы вещи не меняются.',
    drops: [
      { weight: 60, reward: skin('ryvok_city') },
      { weight: 40, reward: skin('ryvok_parade') },
    ] },
];

export const getCase = (id) => CASES.find((c) => c.id === id);
