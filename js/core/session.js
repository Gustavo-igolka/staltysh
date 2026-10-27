// Кто сейчас играет: user = пользователь Supabase или null (локальная игра)
export const session = { user: null };
export const GUEST_FLAG = 'shooter:guest';

// ── Белый список разработчиков ──
// Кнопка «Режим разработчика» доступна только аккаунтам из этого списка.
// Впиши сюда email своих dev-аккаунтов (регистр не важен). Пустой список = никто, кроме
// локальной игры без облака (js/config.js не заполнен), девмод не увидит.
export const DEV_EMAILS = [
  // 'naemniknejron@gmail.com',
];

// Пользователь — разработчик? В локальной игре (облако не подключено) считаем разработчиком текущего игрока,
// чтобы девмод можно было включать без сервера.
export function isDev() {
  if (!session.user) return true; // гость / локальная игра без облака
  const email = String(session.user.email ?? '').toLowerCase();
  return DEV_EMAILS.some((e) => e.toLowerCase() === email);
}
