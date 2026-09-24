import { getClient } from './supabase.js';

export async function getUser() {
  try {
    const c = await getClient();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    return data.session?.user ?? null;
  } catch { return null; }
}

export async function signIn(email, password) {
  const c = await needClient();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

// Если в проекте включено подтверждение почты, session будет null — нужно перейти по ссылке из письма
export async function signUp(email, password, nickname) {
  const c = await needClient();
  const { data, error } = await c.auth.signUp({ email, password, options: { data: { nickname } } });
  if (error) throw error;
  return { user: data.user, session: data.session };
}

export async function signOut() {
  const c = await getClient();
  if (c) await c.auth.signOut();
}

// Ник хранится отдельно и уникален (нужен для таблицы рейтинга)
export async function ensureProfile(userId, nickname) {
  const c = await getClient();
  if (!c) return { ok: false };
  const { error } = await c.from('shooter_profiles').upsert({ user_id: userId, nickname }, { onConflict: 'user_id' });
  if (error) {
    if (error.code === '23505') return { taken: true };
    throw error;
  }
  return { ok: true };
}

async function needClient() {
  const c = await getClient();
  if (!c) throw new Error('Нет связи с сервером. Проверь интернет.');
  return c;
}

export function friendlyError(e) {
  const m = String(e?.message ?? e ?? '');
  if (/invalid login credentials/i.test(m)) return 'Неверная почта или пароль.';
  if (/already registered|already been registered/i.test(m)) return 'Эта почта уже зарегистрирована. Войди в аккаунт.';
  if (/email not confirmed/i.test(m)) return 'Почта не подтверждена. Открой письмо от сервиса и перейди по ссылке.';
  if (/password/i.test(m) && /(6|short|weak)/i.test(m)) return 'Пароль слишком короткий: нужно минимум 6 символов.';
  if (/rate limit|too many/i.test(m)) return 'Слишком много попыток. Подожди минуту.';
  if (/failed to fetch|network|нет связи/i.test(m)) return 'Нет связи с сервером. Проверь интернет.';
  return m || 'Что-то пошло не так. Попробуй ещё раз.';
}
