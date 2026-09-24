import { h } from '../core/dom.js';
import { getState, mutate, setState, defaultState } from '../core/state.js';
import { session, GUEST_FLAG } from '../core/session.js';
import { cloudEnabled } from '../net/supabase.js';
import { signOut, ensureProfile } from '../net/auth.js';
import { ITEM_LIST, getItem } from '../data/items.js';
import { addToStash } from '../game/inventory.js';
import { section, chips, toggle, refresh } from './common.js';
import { confirmSheet } from './sheet.js';
import { toast } from './toast.js';

const NICK_RE = /^[\p{L}\p{N}_\- ]{3,20}$/u;
const CONTROLS = [['auto', 'Авто'], ['touch', 'Сенсорное'], ['keyboard', 'Клавиатура и мышь']];
const QUALITY = [['low', 'Низкое'], ['medium', 'Среднее'], ['high', 'Высокое']];

export function renderSettings(root) {
  const s = getState();
  const set = (patch) => mutate((st) => { Object.assign(st.settings, patch); });

  const nickInput = h('input', { type: 'text', value: s.nickname, maxlength: 20, autocomplete: 'off', 'aria-label': 'Позывной' });
  const saveNick = async () => {
    const nick = nickInput.value.trim();
    if (!NICK_RE.test(nick)) return toast('Позывной: 3–20 символов, буквы, цифры, пробел, _ и -', 'warn');
    if (nick === s.nickname) return;
    if (session.user) {
      try {
        const r = await ensureProfile(session.user.id, nick);
        if (r.taken) return toast('Этот позывной уже занят. Выбери другой', 'warn');
      } catch { return toast('Не удалось сохранить позывной на сервере. Проверь интернет', 'warn'); }
    }
    mutate((st) => { st.nickname = nick; });
    toast('Позывной сохранён', 'ok');
  };

  const account = cloudEnabled()
    ? (session.user
        ? [h('p', { class: 'muted' }, `Вход выполнен: ${session.user.email}. Прогресс сохраняется в облако.`),
           h('button', { class: 'btn ghost', onclick: async () => { await signOut(); localStorage.removeItem(GUEST_FLAG); location.reload(); } }, 'Выйти из аккаунта')]
        : [h('p', { class: 'muted' }, 'Ты играешь без аккаунта: прогресс хранится только в этом браузере, рейтинг недоступен.'),
           h('button', { class: 'btn primary', onclick: () => { localStorage.removeItem(GUEST_FLAG); location.reload(); } }, 'Войти или создать аккаунт')])
    : [h('p', { class: 'muted' }, 'Облако не подключено: прогресс хранится только в этом браузере. Чтобы включить вход и рейтинг, заполни js/config.js.')];

  root.append(
    h('h2', { class: 'screen-title' }, 'Настройки'),
    section('Аккаунт',
      h('label', { class: 'field' }, h('span', null, 'Позывной'), nickInput),
      h('button', { class: 'btn small', onclick: saveNick }, 'Сохранить позывной'),
      ...account),
    section('Игра',
      toggle('Звуки', s.settings.sound, (v) => set({ sound: v })),
      toggle('Музыка', s.settings.music, (v) => set({ music: v })),
      h('p', { class: 'muted' }, 'Управление в бою'),
      chips(CONTROLS, s.settings.controls, (v) => set({ controls: v })),
      h('p', { class: 'muted' }, 'Качество графики'),
      chips(QUALITY, s.settings.quality, (v) => set({ quality: v }))),
    section('Данные',
      h('button', { class: 'btn danger', onclick: () => confirmSheet('Сбросить прогресс?', 'Деньги, склад, снаряжение и боевой пропуск вернутся к началу. Позывной останется. Это нельзя отменить.', 'Сбросить', () => {
        setState(defaultState(getState().nickname));
        toast('Прогресс сброшен');
      }) }, 'Сбросить прогресс')),
    section('Для разработки',
      toggle('Режим разработчика', s.settings.dev, (v) => set({ dev: v })),
      s.settings.dev ? devTools() : null));
}

const eachGear = (st, fn) =>
  [...Object.values(st.slots), ...st.inventory, ...st.stash].forEach((it) => { if (it && getItem(it.id).durMax) fn(it); });

function devTools() {
  const b = (label, fn) => h('button', { class: 'btn small ghost', onclick: () => { mutate(fn); toast(label, 'ok'); } }, label);
  return h('div', { class: 'btn-row' },
    b('+1000 денег', (st) => { st.wallet.money += 1000; }),
    b('+100 хромогронитов', (st) => { st.wallet.chromogroniti += 100; }),
    b('+100 опыта пропуска', (st) => { st.pass.xp += 100; }),
    b('Ресурсы ×5 на склад', (st) => { for (const d of ITEM_LIST().filter((i) => i.type === 'resource')) addToStash(st, { id: d.id, count: 5, tier: 0 }); }),
    b('Сломать всё снаряжение', (st) => eachGear(st, (it) => { it.dur = 0; })),
    b('Починить всё снаряжение', (st) => eachGear(st, (it) => { it.dur = getItem(it.id).durMax; })),
    b('Хлам на склад', (st) => { for (const d of ITEM_LIST().filter((i) => i.type === 'junk')) addToStash(st, { id: d.id, count: 3, tier: 0 }); }));
}
