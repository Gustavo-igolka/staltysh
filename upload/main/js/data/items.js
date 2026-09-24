// Все предметы игры. Баланс правится здесь, код трогать не нужно.
import { uid } from '../core/util.js';

// ── Редкости ────────────────────────────────────────────────
export const RARITY = {
  grey:   { name: 'Серый',      css: 'var(--r-grey)' },
  blue:   { name: 'Синий',      css: 'var(--r-blue)' },
  purple: { name: 'Фиолетовый', css: 'var(--r-purple)' },
  red:    { name: 'Красный',    css: 'var(--r-red)' },
};
export const RARITY_ORDER = ['grey', 'blue', 'purple', 'red'];

// 7 ступеней улучшения оружия/брони/рюкзаков: индекс = tier предмета
export const TIERS = ['grey', 'grey', 'blue', 'blue', 'purple', 'purple', 'red'];

// ── Типы и категории ────────────────────────────────────────
export const TYPE_NAMES = {
  weapon: 'Оружие', secondary: 'Доп. оружие', armor: 'Броня', backpack: 'Рюкзак / сумка',
  ammo: 'Патроны', medical: 'Медицина', install: 'Установка', tool: 'Инструмент',
  resource: 'Бартерный ресурс', junk: 'Хлам',
};
export const CATEGORIES = {
  gear: ['weapon', 'secondary', 'armor', 'backpack'],
  consumable: ['ammo', 'medical', 'install', 'tool'],
  resource: ['resource'],
  junk: ['junk'],
};
export const categoryOf = (def) =>
  Object.keys(CATEGORIES).find((c) => CATEGORIES[c].includes(def.type)) ?? 'junk';

// ── Реестр ──────────────────────────────────────────────────
const ITEMS = {};
function add(o) {
  ITEMS[o.id] = { w: 1, h: 1, weight: 0.1, stack: 1, rarity: 'grey', price: 0, sell: 0, ...o };
}

export function getItem(id) {
  return ITEMS[id] ?? { id, name: 'Неизвестный предмет', type: 'junk', w: 1, h: 1, weight: 0, stack: 1, rarity: 'grey', price: 0, sell: 0 };
}
export const ITEM_LIST = () => Object.values(ITEMS);

// ── Оружие (первая, самая слабая ступень каждой ветки). Дальность в клетках карты, время в секундах ──
// speed — штраф скорости, только пока оружие в руках. durMax — максимальная прочность.
add({ id: 'w_pi_1',  name: 'Старый пистолет',    type: 'secondary', slot: 'secondary', w: 2, h: 1, weight: 1,   price: 300,  ammo: 'ammo_pistol', durMax: 80,
  stats: { dmg: 9,  rate: 3,   mag: 12, range: 8,  reloadFull: 1.6, reloadTac: 1.1, draw: 0.4, speed: -1 }, desc: 'Пылился в бункере с самого начала. Стреляет, если не подводить.' });
add({ id: 'w_smg_1', name: 'Самодельный ПП',     type: 'secondary', slot: 'secondary', w: 2, h: 2, weight: 2.5, price: 650,  ammo: 'ammo_pistol', durMax: 70,
  stats: { dmg: 6,  rate: 9,   mag: 25, range: 7,  reloadFull: 2.0, reloadTac: 1.4, draw: 0.5, speed: -1 }, desc: 'Кустарный пистолет-пулемёт. Много шума, мало точности.' });
add({ id: 'w_ar_1',  name: 'Ржавый автомат',     type: 'weapon',    slot: 'weapon',    w: 3, h: 2, weight: 3.5, price: 900,  ammo: 'ammo_ar',     durMax: 100,
  stats: { dmg: 12, rate: 6,   mag: 30, range: 13, reloadFull: 2.4, reloadTac: 1.7, draw: 0.8, speed: -2 }, desc: 'Дешёвый автомат из старых запасов. Работает, пока не заклинит.' });
add({ id: 'w_sn_1',  name: 'Охотничья винтовка', type: 'weapon',    slot: 'weapon',    w: 4, h: 2, weight: 4,   price: 1200, ammo: 'ammo_sniper', durMax: 90,
  stats: { dmg: 45, rate: 1,   mag: 5,  range: 26, reloadFull: 3.0, reloadTac: 2.2, draw: 1.1, speed: -3, bleedChance: 25, stop: 40 }, desc: 'Точная, но медленная. Каждый патрон на счету.' });
add({ id: 'w_mg_1',  name: 'Пулемёт-самоделка',  type: 'weapon',    slot: 'weapon',    w: 4, h: 2, weight: 7,   price: 1600, ammo: 'ammo_mg',     durMax: 120,
  stats: { dmg: 10, rate: 9,   mag: 80, range: 15, reloadFull: 5.0, reloadTac: 3.8, draw: 1.4, speed: -6, stop: 10 }, desc: 'Тяжёлый, зато держит волну врагов на расстоянии.' });
add({ id: 'w_sg_1',  name: 'Обрез',              type: 'weapon',    slot: 'weapon',    w: 3, h: 1, weight: 3,   price: 800,  ammo: 'ammo_shell',  durMax: 90,
  stats: { dmg: 40, rate: 1.2, mag: 2,  range: 6,  reloadFull: 2.0, reloadTac: 1.0, draw: 0.7, speed: -3, mutantMult: 1.5 }, desc: 'Бьёт страшно, особенно мутантов, но только вблизи.' });

// ── Броня: первая ступень каждой ветки. Значения прибавляются к базе персонажа (см. data/player.js) ──
// Боевая — против пуль, разрывов, взрывов. Научная — против заражений. Комбинированная — что-то среднее.
add({ id: 'a_light_1', name: 'Куртка с накладками',      type: 'armor', armorClass: 'combat',  slot: 'armor', w: 2, h: 2, weight: 3,  price: 500,  durMax: 80, stats: { bullet: 15, tear: 10, speed: -1, carry: 3 },                                  desc: 'Лёгкая защита, почти не мешает бегать.' });
add({ id: 'a_med_1',   name: 'Бронежилет-самоделка',     type: 'armor', armorClass: 'combat',  slot: 'armor', w: 3, h: 3, weight: 7,  price: 900,  durMax: 120, stats: { bullet: 40, tear: 20, blast: 15, bleedProt: 10, speed: -4, carry: 5 },         desc: 'Пластины из того, что нашлось. Держит удар.' });
add({ id: 'a_heavy_1', name: 'Костюм из листовой стали', type: 'armor', armorClass: 'combat',  slot: 'armor', w: 3, h: 3, weight: 12, price: 1400, durMax: 200, stats: { bullet: 90, tear: 60, blast: 40, bleedProt: 20, speed: -12, carry: 10 },        desc: 'Тяжёлый и громкий. Пули отскакивают.' });
add({ id: 'a_sci_1',   name: 'Защитный комбинезон',      type: 'armor', armorClass: 'science', slot: 'armor', w: 2, h: 2, weight: 4,  price: 1000, durMax: 80, stats: { rad: 100, bio: 100, temp: 30, speed: -3 },                                     desc: 'Закрывает от заражений 1 уровня. От пуль не спасёт.' });
add({ id: 'a_sci_2',   name: 'Костюм-изолятор',          type: 'armor', armorClass: 'science', slot: 'armor', w: 3, h: 3, weight: 8,  price: 1500, durMax: 120, stats: { psi: 100, bio: 100, temp: 50, speed: -6, carry: 2 },                           desc: 'Герметичный костюм с фильтрами. Душно и неповоротливо.' });
add({ id: 'a_mix_1',   name: 'Экспедиционная куртка',    type: 'armor', armorClass: 'combo',   slot: 'armor', w: 2, h: 2, weight: 5,  price: 1100, durMax: 90, stats: { bullet: 25, tear: 10, blast: 5, rad: 100, speed: -3, carry: 4 },               desc: 'Немного брони и немного защиты от радиации.' });
add({ id: 'a_mix_2',   name: 'Полевой костюм',           type: 'armor', armorClass: 'combo',   slot: 'armor', w: 3, h: 3, weight: 8,  price: 1300, durMax: 110, stats: { bullet: 30, tear: 15, bio: 100, speed: -5, carry: 6 },                        desc: 'Держит и удар, и заражение, но ни в чём не лучший.' });

// ── Рюкзаки и сумки (weightBonus — прибавка к переносимому весу; размер сетки инвентаря от них не зависит) ──
add({ id: 'bp_1',  name: 'Старый рюкзак',  type: 'backpack', slot: 'backpack', w: 3, h: 3, weight: 1.5, price: 400, weightBonus: 18, stats: { speed: -2 }, desc: 'Даёт много переносимого веса, но заметный и тяжёлый.' });
add({ id: 'bag_1', name: 'Поясная сумка',  type: 'backpack', slot: 'backpack', w: 2, h: 1, weight: 0.5, price: 250, weightBonus: 8, stats: { speed: -1 }, desc: 'Компактная сумка. Немного веса, зато лёгкая.' });

// ── Патроны ──────────────────────────────────────────────────
add({ id: 'ammo_pistol', name: 'Патроны 9 мм',                 type: 'ammo', weight: 0.02, stack: 60,  price: 4 });
add({ id: 'ammo_ar',     name: 'Патроны 5.45',                 type: 'ammo', weight: 0.03, stack: 60,  price: 6 });
add({ id: 'ammo_sniper', name: 'Патроны 7.62 (винтовочные)',   type: 'ammo', weight: 0.05, stack: 30,  price: 15 });
add({ id: 'ammo_mg',     name: 'Патроны 7.62 (ленточные)',     type: 'ammo', weight: 0.04, stack: 100, price: 8 });
add({ id: 'ammo_shell',  name: 'Патроны 12 калибра',           type: 'ammo', weight: 0.06, stack: 30,  price: 8 });

// ── Медицина, установки, инструменты ─────────────────────────
add({ id: 'medkit',  name: 'Аптечка', type: 'medical', weight: 0.5, stack: 5,  price: 150, heal: 50, desc: 'Восстанавливает 50 здоровья.' });
add({ id: 'bandage', name: 'Бинты',   type: 'medical', weight: 0.1, stack: 10, price: 40,  heal: 15, desc: 'Быстро останавливают кровотечение.' });
add({ id: 'anomaly_install', name: 'Аномальная установка', type: 'install', w: 2, h: 2, weight: 4, stack: 2, price: 800, desc: 'Ставится на особой точке в открытом мире. Мутанты будут пытаться её сломать; через 3 минуты она выдаст ресурсы и хлам.' });
add({ id: 'metal_detector', name: 'Металлоискатель', type: 'tool', w: 1, h: 2, weight: 2, price: 600, desc: 'Нужен, чтобы находить прикопы.' });

// ── Хлам (только на продажу) ─────────────────────────────────
add({ id: 'j_gear',     name: 'Ржавая шестерня',         type: 'junk', weight: 0.3, stack: 20, sell: 12 });
add({ id: 'j_wire',     name: 'Обрывок проводов',        type: 'junk', weight: 0.2, stack: 20, sell: 15 });
add({ id: 'j_compass',  name: 'Разбитый компас',         type: 'junk', weight: 0.2, stack: 10, sell: 40 });
add({ id: 'j_canister', name: 'Пустая канистра',         type: 'junk', h: 2, weight: 1,   stack: 5, sell: 30 });
add({ id: 'j_radio',    name: 'Сломанный радиоприёмник', type: 'junk', w: 2, weight: 1.2, stack: 3, sell: 45 });
add({ id: 'j_dosim',    name: 'Треснувший дозиметр',     type: 'junk', h: 2, weight: 0.8, stack: 3, sell: 70 });

// ── Бартерные ресурсы: тип × редкость ────────────────────────
// Чем дальше от бункера, тем реже. Прикопы дают ресурсы от синей редкости, разломы — от фиолетовой.
export const RES_TYPES = {
  mutant: { name: 'Мох',              source: 'Споты мутантов',      rarities: ['grey', 'blue', 'purple', 'red'], needs: null },
  human:  { name: 'Нашивка',          source: 'Споты людей',         rarities: ['grey', 'blue', 'purple', 'red'], needs: null },
  stash:  { name: 'Медная проволока', source: 'Прикопы',             rarities: ['blue', 'purple', 'red'],         needs: 'metal_detector' },
  rift:   { name: 'Маячок «Альфа»',   source: 'Аномальные разломы',  rarities: ['purple', 'red'],                 needs: 'anomaly_install' },
};
// Ресурсы каких типов нужны вещам каждой редкости
export const GEAR_RESOURCES = {
  grey:   ['mutant', 'human'],
  blue:   ['mutant', 'human', 'stash'],
  purple: ['mutant', 'human', 'stash', 'rift'],
  red:    ['mutant', 'human', 'stash', 'rift'],
};
export const resId = (type, rarity) => `res_${type}_${rarity}`;
for (const [type, t] of Object.entries(RES_TYPES)) {
  for (const rarity of t.rarities) {
    add({ id: resId(type, rarity), name: t.name, type: 'resource', rarity, resType: type, weight: 0.1, stack: 99, desc: `Источник: ${t.source}.` });
  }
}

// ── Создание экземпляра предмета ─────────────────────────────
export const createItem = (id, count = 1, tier = 0) => ({
  uid: uid(), id, count, tier,
  ...(ITEMS[id]?.durMax ? { dur: ITEMS[id].durMax } : {}), // прочность экземпляра
});

// ── Магазин ──────────────────────────────────────────────────
export const SHOP = [
  { id: 'ammo',      name: 'Патроны',      items: ['ammo_pistol', 'ammo_ar', 'ammo_sniper', 'ammo_mg', 'ammo_shell'] },
  { id: 'medical',   name: 'Аптечки',      items: ['medkit', 'bandage'] },
  { id: 'buffs',     name: 'Баффы',        items: [], soon: true },
  { id: 'equipment', name: 'Установки',    items: ['anomaly_install', 'metal_detector'] },
];
