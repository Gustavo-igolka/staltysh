import { h } from '../core/dom.js';
import { getState, mutate, setState, defaultState } from '../core/state.js';
import { session, GUEST_FLAG, isDev } from '../core/session.js';
import { cloudEnabled } from '../net/supabase.js';
import { signOut, ensureProfile } from '../net/auth.js';
import { ITEM_LIST, getItem } from '../data/items.js';
import { addToStash } from '../game/inventory.js';
import { DEFAULT_KEYS, KEY_LABELS, ALT_KEYS, keyName } from '../game/input.js';
import { section, chips, toggle, refresh } from './common.js';
import { confirmSheet } from './sheet.js';
import { toast } from './toast.js';

const NICK_RE = /^[\p{L}\p{N}_\- ]{3,20}$/u;
const CONTROLS = [['auto', 'Авто'], ['touch', 'Сенсорное'], ['keyboard', 'Клавиатура и мышь']];
const QUALITY = [['low', 'Низкое'], ['medium', 'Среднее'], ['high', 'Высокое']];
const TABS = [['general', 'Общее'], ['controls', 'Управление']];
const RESERVED = new Set(Object.values(ALT_KEYS)); // запасные клавиши назначить нельзя

let tab = 'general';

// Переназначение клавиши: ждём следующее нажатие. Слушатель висит в фазе перехвата и гасит событие,
// чтобы игра (она слушает окно) не приняла эту клавишу за команду.
function rebind(action, btn) {
  btn.textContent = 'Нажми клавишу…';
  const onKey = (e) => {
    e.preventDefault(); e.stopImmediatePropagation();
    window.removeEventListener('keydown', onKey, true);
    if (e.code === 'Escape') return refresh();
    if (RESERVED.has(e.code)) { toast('Эта клавиша занята под запасное управление', 'warn'); return refresh(); }
    mutate((st) => {
      const cur = { ...DEFAULT_KEYS, ...st.settings.keys };
      const other = Object.keys(cur).find((a) => a !== action && cur[a] === e.code);
      const next = { ...cur, [action]: e.code };
      if (other) next[other] = cur[action]; // конфликт: меняем местами
      st.settings.keys = next;
    });
    refresh();
  };
  window.addEventListener('keydown', onKey, true);
}

function controlsSections(s, set) {
  const kb = { ...DEFAULT_KEYS, ...s.settings.keys };
  return [
    section('Режим управления',
      chips(CONTROLS, s.settings.controls, (v) => { set({ controls: v }); refresh(); }),
      h('p', { class: 'muted small' }, 'Режим применяется при следующем заходе в открытый мир.')),
    section('Клавиатура',
      h('div', { class: 'rows' }, Object.keys(DEFAULT_KEYS).map((a) => {
        const b = h('button', { class: 'btn small ghost' }, keyName(kb[a]));
        b.onclick = () => rebind(a, b);
        return h('div', { class: 'row' },
          h('div', { class: 'row-main' }, h('b', null, KEY_LABELS[a])),
          h('div', { class: 'row-act' }, b));
      })),
      h('p', { class: 'muted small' }, 'Клавиши привязаны к физическому положению, поэтому работают и на русской раскладке. Стрелки, F и P всегда работают как запасные. Стрельба мышью (ЛКМ) не меняется. Esc отменяет назначение.'),
      h('button', { class: 'btn danger small', onclick: () => { set({ keys: {} }); refresh(); } }, 'Сбросить клавиши')),
    section('Телефон',
      toggle('Авто-прицел по направлению движения', s.settings.autoAim !== false, (v) => { set({ autoAim: v }); refresh(); })),
  ];
}

export function renderSettings(root) {
  const s = getState();
  const set = (patch) => mutate((st) => { Object.assign(st.settings, patch); });
  const title = h('h2', { class: 'screen-title' }, 'Настройки');
  const tabs = chips(TABS, tab, (v) => { tab = v; refresh(); });

  if (tab === 'controls') {
    root.append(title, tabs, ...controlsSections(s, set));
    return;
  }

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
    title,
    tabs,
    section('Аккаунт',
      h('label', { class: 'field' }, h('span', null, 'Позывной'), nickInput),
      h('button', { class: 'btn small', onclick: saveNick }, 'Сохранить позывной'),
      ...account),
    section('Игра',
      toggle('Звуки', s.settings.sound, (v) => set({ sound: v })),
      toggle('Музыка', s.settings.music, (v) => set({ music: v })),
      h('p', { class: 'muted' }, 'Качество графики'),
      chips(QUALITY, s.settings.quality, (v) => set({ quality: v }))),
    section('Данные',
      h('button', { class: 'btn danger', onclick: () => confirmSheet('Сбросить прогресс?', 'Деньги, склад, снаряжение и боевой пропуск вернутся к началу. Позывной останется. Это нельзя отменить.', 'Сбросить', () => {
        setState(defaultState(getState().nickname));
        toast('Прогресс сброшен');
      }) }, 'Сбросить прогресс')),
    // Секция разработчика — только для аккаунтов из белого списка DEV_EMAILS (js/core/session.js).
    // Обычные игроки её не видят: вместо текстового ввода — одна кнопка вкл/выкл девмода.
    isDev() ? devSection(set) : null);
}

// Кнопка-переключатель «Режим разработчика»: включил — в открытом мире появились dev-панель
// и консоль команд; выключил — чистая игра. Никакого текста в меню вводить не нужно.
function devSection(set) {
  const on = getState().settings.dev;
  const btn = h('button', { class: 'btn ' + (on ? 'danger' : 'ghost') },
    on ? 'Режим разработчика: ВКЛ — выключить' : 'Режим разработчика: ВЫКЛ — включить');
  btn.onclick = () => {
    set({ dev: !on });
    toast(!on ? 'Девмод включён: панель появится в открытом мире' : 'Девмод выключен', 'ok');
    refresh();
  };
  return section('Для разработки',
    btn,
    h('p', { class: 'muted small' }, 'Доступно только разработчикам (белый список email в js/core/session.js).'),
    on ? devTools() : null);
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
