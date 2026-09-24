// Типы клеток карты. В файлах карт каждая клетка — один символ из этой таблицы.
export const TILE = 32; // размер клетки в игровых пикселях

export const TILES = {
  '.': { name: 'земля',          color: '#3a4035', speed: 1 },
  'g': { name: 'трава',          color: '#2e4629', speed: 1 },
  'm': { name: 'болотная жижа',  color: '#37452a', speed: 0.7 },
  'w': { name: 'мелководье',     color: '#28494c', speed: 0.55 },
  'W': { name: 'глубокая вода',  color: '#132c2e', solid: true },                      // не пройти, пули летят над водой
  'T': { name: 'дерево',         color: '#1d3520', solid: true, blocksBullets: true },
  '#': { name: 'руины',          color: '#4b4b47', solid: true, blocksBullets: true },
  '=': { name: 'тропа',          color: '#584e3d', speed: 1.1 },
  'b': { name: 'территория бункера', color: '#2a322f', speed: 1 },
};

export function tileAt(map, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return TILES['T']; // за краем карты — стена
  return TILES[map.tiles[ty][tx]] ?? TILES['.'];
}
