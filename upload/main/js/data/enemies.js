// Виды врагов и мишеней. Пока это мишени полигона (стоят на месте); ИИ добавим на следующем этапе.
// mutant: true — на мутантов действует множитель урона оружия (например, у обреза). dmgType — каким уроном бьёт враг.
export const ENEMY_KINDS = {
  boar:    { name: 'Кабан',   mutant: true,  hp: 300, r: 13, color: '#7b4a29', dmgType: 'tear' },
  dog:     { name: 'Пёс',     mutant: true,  hp: 150, r: 10, color: '#8b8b80', dmgType: 'tear' },
  bandit:  { name: 'Бандит',  mutant: false, hp: 200, r: 10, color: '#a5443a', dmgType: 'bullet' },
  soldier: { name: 'Военный', mutant: false, hp: 400, r: 10, color: '#5f7c3c', dmgType: 'bullet' },
};
