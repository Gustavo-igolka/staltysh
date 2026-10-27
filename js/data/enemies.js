// Виды врагов. mutant: true — на мутантов действует множитель урона оружия (например, у обреза).
// dmgType — каким уроном бьёт враг. squad — [мин, макс] размер отряда на точке. variancePct — разброс
// характеристик конкретного экземпляра НПС (±%), запрошенный отдельно от базовых чисел вида.
export const ENEMY_KINDS = {
  boar: {
    name: 'Кабан', mutant: true, hp: 300, r: 13, color: '#7b4a29', dmgType: 'tear',
    moveSpeed: 150, vision: 9 * 32, squad: [2, 4], variancePct: 6, kbMass: 2.5, // тяжёлый — почти не отбрасывается
    melee: { range: 38, dmg: 16, rate: 1.1 }, fleeHpPct: 25, fleeTime: 2.5,
  },
  dog: {
    name: 'Пёс', mutant: true, hp: 150, r: 10, color: '#8b8b80', dmgType: 'tear',
    moveSpeed: 190, vision: 9 * 32, squad: [2, 4], variancePct: 6, kbMass: 1, // лёгкий — прилично слетает с выстрела
    melee: { range: 34, dmg: 10, rate: 1.4 }, fleeHpPct: 25, fleeTime: 2.5,
  },
  bandit: {
    name: 'Бандит', mutant: false, hp: 90, r: 10, color: '#a5443a', dmgType: 'bullet',
    moveSpeed: 130, vision: 14 * 32, squad: [3, 5], variancePct: 6, kbMass: 1.4,
    ranged: { range: 11 * 32, rate: 1.4, dmg: 9, accuracyDeg: 9, reposition: 3.5 },
  },
  soldier: {
    name: 'Военный', mutant: false, hp: 160, r: 10, color: '#5f7c3c', dmgType: 'bullet',
    moveSpeed: 125, vision: 15 * 32, squad: [5, 8], variancePct: 6, kbMass: 1.6,
    ranged: { range: 13 * 32, rate: 1.1, dmg: 14, accuracyDeg: 6, reposition: 4 },
  },
};
export const HUMAN_KINDS = ['bandit', 'soldier'];
export const MUTANT_KINDS = ['boar', 'dog'];
