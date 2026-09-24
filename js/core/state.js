// Единое состояние игрока. Менять только через mutate() — он оповещает интерфейс и запускает автосохранение.
import { emit } from './events.js';
import { createItem } from '../data/items.js';

export const STATE_VERSION = 1;
let state = null;

export function defaultState(nickname = 'Выживший') {
  return {
    v: STATE_VERSION,
    updatedAt: Date.now(),
    nickname,
    wallet: { money: 1500, chromogroniti: 0 },
    // слоты персонажа: то, что не теряется при смерти
    slots: { weapon: null, secondary: null, armor: null, backpack: null },
    inventory: [], // «текущий инвентарь» — то, что берётся в открытый мир (сетка с весом)
    stash: [       // склад бункера — всё, чем владеет игрок
      createItem('j_gear', 6),
      createItem('j_radio', 1),
      createItem('j_dosim', 1),
    ],
    pass: { season: 1, xp: 0, claimed: [], coupons: [], pendingRedChoice: false },
    settings: { sound: true, music: true, controls: 'auto', quality: 'high', dev: false },
  };
}

// Дополняет старое сохранение недостающими полями (на случай обновлений игры)
export function migrateState(saved, nickname) {
  const base = defaultState(nickname);
  if (!saved || typeof saved !== 'object') return base;
  return {
    ...base,
    ...saved,
    v: STATE_VERSION,
    wallet: { ...base.wallet, ...saved.wallet },
    slots: { ...base.slots, ...saved.slots },
    pass: { ...base.pass, ...saved.pass },
    settings: { ...base.settings, ...saved.settings },
    inventory: Array.isArray(saved.inventory) ? saved.inventory : [],
    stash: Array.isArray(saved.stash) ? saved.stash : [],
  };
}

export const getState = () => state;

export function setState(next) {
  state = next;
  emit('state:change', state);
}

// fn(state) меняет состояние и возвращает {ok:true,...} или {ok:false,msg}. При отказе ничего не сохраняется.
export function mutate(fn) {
  const res = fn(state);
  if (res && res.ok === false) return res;
  state.updatedAt = Date.now();
  emit('state:change', state);
  return res ?? { ok: true };
}
