// Точка входа: вход/сохранение → каркас → экраны
import { h } from './core/dom.js';
import { on } from './core/events.js';
import { startGame } from './game/session.js';
import { getState, setState, migrateState } from './core/state.js';
import { session, GUEST_FLAG } from './core/session.js';
import { cloudEnabled } from './net/supabase.js';
import { getUser, ensureProfile } from './net/auth.js';
import { loadLocal, loadCloud } from './net/save.js';
import { startSync } from './net/sync.js';
import { createShell } from './ui/shell.js';
import { showAuth } from './ui/auth.js';
import { toast } from './ui/toast.js';
import { closeSheet } from './ui/sheet.js';
import { renderHome } from './ui/home.js';
import { renderInventory } from './ui/inventory.js';
import { renderShop } from './ui/shop.js';
import { renderBarter } from './ui/barter.js';
import { renderPass } from './ui/pass.js';
import { renderDonate } from './ui/donate.js';
import { renderSettings } from './ui/settings.js';

const SCREENS = [
  { id: 'home',      label: 'Главное',    icon: '⌂', render: renderHome },
  { id: 'inventory', label: 'Инвентарь',  icon: '▦', render: renderInventory },
  { id: 'shop',      label: 'Магазин',    icon: '¤', render: renderShop },
  { id: 'barter',    label: 'Бартер',     icon: '⇄', render: renderBarter },
  { id: 'pass',      label: 'Пропуск',    icon: '★', render: renderPass },
  { id: 'donate',    label: 'Донат',      icon: '◆', render: renderDonate },
  { id: 'settings',  label: 'Настройки',  icon: '⚙', render: renderSettings },
];

const root = document.getElementById('app');

async function loadPlayerState(user) {
  const uid = user?.id ?? null;
  const fallbackNick = user?.user_metadata?.nickname || user?.email?.split('@')[0] || 'Выживший';
  let saved = loadLocal(uid);
  if (user) {
    try {
      const cloud = await loadCloud(uid);
      if (cloud && (!saved || (cloud.updatedAt ?? 0) >= (saved.updatedAt ?? 0))) saved = cloud;
      else if (!cloud && !saved) saved = loadLocal(null); // первый вход: забираем прогресс гостя
    } catch (e) {
      console.warn('[save] облако недоступно, беру локальное сохранение', e);
    }
  }
  setState(migrateState(saved, fallbackNick));
}

function mountApp() {
  const shell = createShell(SCREENS, navigate);
  let current = 'home';
  let queued = false;
  let visible = true;

  function render(keepScroll) {
    const top = keepScroll ? shell.main.scrollTop : 0;
    shell.main.replaceChildren();
    const screen = SCREENS.find((s) => s.id === current);
    try {
      screen.render(shell.main);
    } catch (e) {
      console.error(`[ui] ошибка на экране «${current}»`, e);
      shell.main.replaceChildren(h('div', { class: 'empty' }, h('b', null, 'Экран не открылся'), h('p', null, 'Попробуй перейти в другой раздел и вернуться.')));
    }
    shell.main.scrollTop = top;
    shell.setActive(current);
  }

  function navigate(id) {
    if (!SCREENS.some((s) => s.id === id)) return;
    closeSheet();
    current = id;
    render(false);
  }

  const scheduleRender = () => {
    if (!visible) return;
    shell.updateTop(getState());
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; render(true); });
  };

  on('state:change', scheduleRender);
  on('ui:refresh', scheduleRender);
  on('nav', navigate);
  on('sync:status', (st) => shell.setSync(st));

  root.replaceChildren(shell.el);
  shell.updateTop(getState());
  render(false);

  return {
    hide() { visible = false; },
    show() { visible = true; root.replaceChildren(shell.el); shell.updateTop(getState()); render(true); },
  };
}

async function start() {
  root.replaceChildren(h('div', { class: 'boot' }, 'Загрузка…'));

  let user = null;
  if (cloudEnabled()) {
    user = await getUser();
    if (!user && localStorage.getItem(GUEST_FLAG) !== '1') {
      const res = await showAuth(root);
      if (res.user) user = res.user;
      else localStorage.setItem(GUEST_FLAG, '1');
    }
  }
  session.user = user;

  await loadPlayerState(user);
  const app = mountApp();
  startSync(user?.id ?? null);

  // открытый мир: прячем меню, запускаем игру, по возвращении показываем меню
  let playing = false;
  on('game:start', () => {
    if (playing) return;
    const s = getState();
    if (!s.slots.weapon && !s.slots.secondary) { toast('Нужно оружие: купи первое в бартере', 'warn'); return; }
    playing = true;
    closeSheet();
    app.hide();
    startGame({
      root, mapId: 'swamp',
      onEnd: ({ reason }) => {
        playing = false;
        app.show();
        if (reason === 'death') toast('Ты погиб: инвентарь вылазки потерян', 'warn');
        else if (reason === 'hatch') toast('Ты вернулся в бункер', 'ok');
      },
    });
  });

  if (user) {
    ensureProfile(user.id, getState().nickname)
      .then((r) => { if (r?.taken) toast('Позывной занят другим игроком. Измени его в Настройках', 'warn'); })
      .catch((e) => console.warn('[profile]', e));
  }
}

start().catch((e) => {
  console.error(e);
  root.replaceChildren(h('div', { class: 'boot' }, 'Не удалось запустить игру. Обнови страницу.'));
});
