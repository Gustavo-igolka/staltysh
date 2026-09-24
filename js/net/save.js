// Сохранения: localStorage (всегда) + Supabase (если вошли в аккаунт)
import { getClient } from './supabase.js';

const key = (uid) => `shooter:save:${uid ?? 'guest'}`;

export function loadLocal(uid) {
  try {
    const raw = localStorage.getItem(key(uid));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveLocal(uid, state) {
  try { localStorage.setItem(key(uid), JSON.stringify(state)); return true; } catch { return false; }
}

export async function loadCloud(uid) {
  const c = await getClient();
  if (!c) throw new Error('offline');
  const { data, error } = await c.from('shooter_saves').select('data').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data?.data ?? null;
}

export async function saveCloud(uid, state) {
  const c = await getClient();
  if (!c) throw new Error('offline');
  const { error } = await c.from('shooter_saves').upsert(
    { user_id: uid, data: state, version: state.v, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}
