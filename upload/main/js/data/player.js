// Константы персонажа БЕЗ брони и сумки. Броня и рюкзак прибавляют к ним свои значения.
export const BASE_STATS = {
  health: 100,          // здоровье, хп
  survivability: 100,   // живучесть, %
  speed: 100,           // скорость, %
  bullet: 0,            // пулестойкость
  tear: 0,              // защита от разрыва (мутанты, ближний бой)
  blast: 0,             // защита от взрыва
  bleedProt: 0,         // защита от кровотечения, %
  bleedRemoval: 4,      // вывод кровотечения, %
  rad: 0, bio: 0, psi: 0, temp: 0, // защита от радиации / биозаражения / пси / температуры (очки: 100 на каждый уровень зоны)
  cleanseRate: 4,       // вывод радиации / биозаражения / пси-заражения, %/с
  burnRemoval: 20,      // вывод ожога, %/с
  carryWeight: 50,      // переносимый вес без брони и сумки, кг
  regenRate: 4,         // регенерация, % здоровья в секунду
  regenDelay: 5,        // регенерация начинается через N секунд после ранения
  periodic: 0,          // периодическое лечение (идёт независимо ни от чего), %
  bleedingBlocksRegen: true, // пока есть кровотечение, здоровье не регенерирует
};

// Характеристики брони (значения прибавляются к базовым). short — для коротких строк в списках.
// optional — необязательный бафф/нерф: броню можно выпускать без него. rare — самая редкая характеристика.
export const ARMOR_STATS = [
  { key: 'bullet',        label: 'Пулестойкость',           short: 'Пули' },
  { key: 'tear',          label: 'Защита от разрыва',       short: 'Разрыв' },
  { key: 'blast',         label: 'Защита от взрыва',        short: 'Взрыв' },
  { key: 'survivability', label: 'Живучесть',               short: 'Живучесть', unit: '%', signed: true, optional: true, rare: true },
  { key: 'speed',         label: 'Скорость',                short: 'Скорость',  unit: '%', signed: true, optional: true },
  { key: 'bleedProt',     label: 'Защита от кровотечения',  short: 'Кровотеч.', unit: '%', optional: true },
  { key: 'bleedRemoval',  label: 'Вывод кровотечения',      short: 'Вывод кр.', unit: '%', signed: true },
  { key: 'rad',           label: 'Защита от радиации',      short: 'Радиация' },
  { key: 'bio',           label: 'Защита от биозаражения',  short: 'Био' },
  { key: 'psi',           label: 'Защита от пси-излучения', short: 'Пси' },
  { key: 'temp',          label: 'Защита от температуры',   short: 'Темп.' },
  { key: 'carry',         label: 'Переносимый вес',         short: 'Груз',      unit: ' кг', signed: true, optional: true },
  { key: 'regen',         label: 'Периодическое лечение',   short: 'Лечение',   unit: '%', optional: true },
];

export const ARMOR_CLASSES = { combat: 'Боевая', science: 'Научная', combo: 'Комбинированная' };

const num = (n) => String(Math.abs(n)).replace('.', ',');

// Оформление значения: знак (если signed), приставка, единицы
export function formatStat(def, value) {
  const sign = def.signed && value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${def.prefix ?? ''}${num(value)}${def.unit ?? ''}`;
}
export const formatArmorStat = formatStat;

// Список [подпись, значение] только по тем характеристикам, что заданы у предмета
export function armorStatItems(stats, short = false) {
  return ARMOR_STATS.filter((d) => stats?.[d.key]).map((d) => [short ? d.short : d.label, formatStat(d, stats[d.key])]);
}

// Характеристики оружия и доп. оружия (один набор на оба).
// core — основные (показываются в коротких строках), optional — необязательные (кровотечение, остановка, множители).
export const WEAPON_STATS = [
  { key: 'dmg',        label: 'Урон',                          short: 'Урон',      core: true },
  { key: 'rate',       label: 'Скорострельность',              short: 'Темп',      unit: ' выстр./с', core: true },
  { key: 'mag',        label: 'Объём магазина',                short: 'Магазин',   core: true },
  { key: 'range',      label: 'Макс. дистанция',               short: 'Дальность', unit: ' кл.', core: true },
  { key: 'reloadFull', label: 'Перезарядка полная',            short: 'Перезар.',  unit: ' с' },
  { key: 'reloadTac',  label: 'Перезарядка тактическая',       short: 'Такт.',     unit: ' с' },
  { key: 'draw',       label: 'Доставание',                    short: 'Достав.',   unit: ' с' },
  { key: 'speed',      label: 'Скорость (когда оружие в руках)', short: 'Скорость', unit: '%', signed: true },
  { key: 'bleedChance', label: 'Шанс кровотечения',            short: 'Кровотеч.', unit: '%', optional: true },
  { key: 'stop',       label: 'Останавливающее действие',      short: 'Остановка', unit: '%', optional: true },
  { key: 'mutantMult', label: 'Множитель урона по мутантам',   short: 'Мутанты',   prefix: '×', optional: true },
];

export function weaponStatItems(stats, short = false) {
  return WEAPON_STATS
    .filter((d) => stats?.[d.key] !== undefined && stats[d.key] !== 0 && (!short || d.core || d.optional))
    .map((d) => [short ? d.short : d.label, formatStat(d, stats[d.key])]);
}

// Рюкзаки и сумки: прибавка к весу, необязательные скорость и живучесть
export function bagStatItems(d, short = false) {
  const items = [[short ? 'Груз' : 'Переносимый вес', `+${d.weightBonus} кг`]];
  for (const def of ARMOR_STATS.filter((x) => x.key === 'speed' || x.key === 'survivability')) {
    if (d.stats?.[def.key]) items.push([short ? def.short : def.label, formatStat(def, d.stats[def.key])]);
  }
  return items;
}
