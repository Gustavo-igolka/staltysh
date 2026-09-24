// Автосохранение: локально почти сразу, в облако — с небольшой задержкой
import { on, emit } from '../core/events.js';
import { getState } from '../core/state.js';
import { saveLocal, saveCloud } from './save.js';

let uid = null;
let tLocal = null;
let tCloud = null;
let dirty = false;

function flushLocal() {
  saveLocal(uid, getState());
  if (!uid) dirty = false;
}

async function flushCloud() {
  if (!uid) return;
  emit('sync:status', 'saving');
  try {
    await saveCloud(uid, getState());
    dirty = false;
    emit('sync:status', 'saved');
  } catch (e) {
    console.error('[sync] облако недоступно', e);
    emit('sync:status', 'error');
  }
}

function flushAll() {
  if (!dirty) return;
  flushLocal();
  flushCloud();
}

export function startSync(userId) {
  uid = userId;
  flushLocal();
  on('state:change', () => {
    dirty = true;
    emit('sync:status', uid ? 'pending' : 'local');
    clearTimeout(tLocal);
    tLocal = setTimeout(flushLocal, 300);
    if (uid) {
      clearTimeout(tCloud);
      tCloud = setTimeout(flushCloud, 2500);
    }
  });
  addEventListener('visibilitychange', () => { if (document.hidden) flushAll(); });
  addEventListener('pagehide', flushAll);
  emit('sync:status', uid ? 'saved' : 'local');
}
