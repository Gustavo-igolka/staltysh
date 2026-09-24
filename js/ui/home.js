import { h } from '../core/dom.js';
import { getState } from '../core/state.js';
import { session } from '../core/session.js';
import { cloudEnabled } from '../net/supabase.js';
import { getItem } from '../data/items.js';
import { getGrid, totalWeight } from '../game/inventory.js';
import { fmtKg } from '../core/util.js';
import { emit } from '../core/events.js';
import { section, goto } from './common.js';
import { toast } from './toast.js';

const SLOTS = [['weapon', 'Оружие'], ['secondary', 'Доп. оружие'], ['armor', 'Броня'], ['backpack', 'Рюкзак']];

function modeButton(title, text, onclick, soon = false) {
  return h('button', { class: 'mode', onclick },
    h('b', null, title),
    h('span', null, text),
    soon ? h('em', null, 'скоро') : null);
}

export function renderHome(root) {
  const s = getState();
  const grid = getGrid(s);
  const weight = totalWeight(s.inventory);
  const armed = !!(s.slots.weapon || s.slots.secondary);

  let ratingNote = null;
  if (!cloudEnabled()) ratingNote = 'Рейтинг заработает после подключения Supabase (см. js/config.js).';
  else if (!session.user) ratingNote = 'Для рейтинга нужен вход в аккаунт (Настройки).';

  root.append(
    h('section', { class: 'hero' },
      h('h1', null, 'Твой бункер'),
      h('p', null, `Позывной: ${s.nickname}. Отсюда начинается любая вылазка, сюда она и должна закончиться.`)),

    h('div', { class: 'modes' },
      modeButton('Открытый мир', 'Локация «Болото»: вылазка от люка бункера на север', () => emit('game:start')),
      modeButton('Рейтинг', 'Раунды с целью и таблица лидеров', () => toast('Рейтинг появится после открытого мира'), true)),
    ratingNote ? h('p', { class: 'note' }, ratingNote) : null,

    section('Снаряжение',
      h('ul', { class: 'loadout' }, SLOTS.map(([k, label]) => {
        const it = s.slots[k];
        return h('li', { class: it ? '' : 'none' }, h('span', null, label), h('b', null, it ? getItem(it.id).name : 'не выбрано'));
      })),
      armed ? null : h('div', { class: 'warn-line' },
        h('span', null, 'Без оружия на вылазку идти нельзя. Первое оружие покупается в бартере.'),
        h('button', { class: 'btn small', onclick: () => goto('barter') }, 'В бартер'))),

    section('Инвентарь вылазки',
      h('p', { class: 'muted' }, `Предметов: ${s.inventory.length} · вес ${fmtKg(weight)} из ${fmtKg(grid.maxWeight)} кг · склад: ${s.stash.length} стопок`)),
  );
}
