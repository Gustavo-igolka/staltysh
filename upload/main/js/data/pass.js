// Боевой пропуск: 25 уровней, один бесплатный трек.
// Бартерных ресурсов в наградах нет. На 25 уровне — красное оружие или броня (выбор появится с углублённым бартером).
export const PASS_LEVELS = 25;
export const PASS_SEASON_DAYS = 30;

const money = (amount) => ({ type: 'money', amount });
const item = (id, count) => ({ type: 'item', id, count });
const coupon = (rarity, percent) => ({ type: 'coupon', rarity, percent });

export const PASS_REWARDS = [
  money(200), item('medkit', 2), item('ammo_ar', 60), money(300), coupon('grey', 10),
  item('bandage', 5), money(400), item('ammo_pistol', 60), item('medkit', 3), coupon('blue', 15),
  money(500), item('ammo_sniper', 30), item('anomaly_install', 1), money(600), coupon('purple', 20),
  item('medkit', 5), item('metal_detector', 1), money(800), item('ammo_mg', 100), coupon('red', 25),
  money(1000), item('ammo_shell', 30), item('anomaly_install', 2), money(1500),
  { type: 'red_gear' },
];

// Опыта нужно всё больше: до уровня n+1 — 100 + 25·n
export function passProgress(xp) {
  let level = 0;
  let spent = 0;
  while (level < PASS_LEVELS) {
    const need = 100 + level * 25;
    if (xp < spent + need) return { level, into: xp - spent, need };
    spent += need;
    level++;
  }
  return { level: PASS_LEVELS, into: 0, need: 0 };
}
