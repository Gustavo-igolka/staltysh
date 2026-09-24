// Экран входа. Возвращает {user} после входа или {guest:true}, если игрок выбрал локальную игру.
import { h } from '../core/dom.js';
import { GUEST_FLAG } from '../core/session.js';
import { signIn, signUp, friendlyError } from '../net/auth.js';

const NICK_RE = /^[\p{L}\p{N}_\- ]{3,20}$/u;

export function showAuth(root) {
  return new Promise((resolve) => {
    let mode = 'login';
    let busy = false;
    let notice = null; // {text, kind}

    const draw = () => {
      const msg = h('p', { class: 'auth-msg ' + (notice?.kind ?? ''), role: 'alert' }, notice?.text ?? '');
      const setMsg = (text, kind = '') => { msg.textContent = text; msg.className = `auth-msg ${kind}`; };
      const nick = mode === 'register'
        ? h('label', { class: 'field' }, h('span', null, 'Позывной'), h('input', { name: 'nick', type: 'text', maxlength: 20, autocomplete: 'nickname' }))
        : null;
      const email = h('input', { name: 'email', type: 'email', autocomplete: 'email', inputmode: 'email' });
      const pass = h('input', { name: 'pass', type: 'password', minLength: 6, autocomplete: mode === 'login' ? 'current-password' : 'new-password' });
      const submit = h('button', { class: 'btn primary wide', type: 'submit' }, mode === 'login' ? 'Войти' : 'Создать аккаунт');

      const form = h('form', { class: 'auth-form', novalidate: true, onsubmit: async (e) => {
        e.preventDefault();
        if (busy) return;
        const v = { email: email.value.trim(), pass: pass.value, nick: nick?.querySelector('input').value.trim() };
        const bad = !v.email.includes('@') ? 'Проверь почту: в адресе нет «@».'
          : v.pass.length < 6 ? 'Пароль: минимум 6 символов.'
          : mode === 'register' && !NICK_RE.test(v.nick ?? '') ? 'Позывной: 3–20 символов, буквы, цифры, пробел, _ и -.' : null;
        if (bad) return setMsg(bad, 'err');

        busy = true; submit.disabled = true; setMsg('Подожди секунду…');
        try {
          if (mode === 'login') {
            const user = await signIn(v.email, v.pass);
            localStorage.removeItem(GUEST_FLAG);
            return resolve({ user });
          }
          const { user, session: sess } = await signUp(v.email, v.pass, v.nick);
          if (sess) { localStorage.removeItem(GUEST_FLAG); return resolve({ user }); }
          mode = 'login';
          notice = { text: 'Аккаунт создан. Подтверди почту по ссылке из письма, затем войди.', kind: 'ok' };
        } catch (err) {
          setMsg(friendlyError(err), 'err');
          busy = false;
          submit.disabled = false;
          return;
        }
        busy = false;
        draw();
      } },
        nick,
        h('label', { class: 'field' }, h('span', null, 'Почта'), email),
        h('label', { class: 'field' }, h('span', null, 'Пароль'), pass),
        msg, submit);

      root.replaceChildren(h('div', { class: 'auth' },
        h('div', { class: 'hazard' }),
        h('h1', null, 'Бункер'),
        h('p', { class: 'muted' }, 'Войди, чтобы прогресс хранился в облаке, а результаты попадали в рейтинг.'),
        h('div', { class: 'chips' },
          h('button', { class: 'chip' + (mode === 'login' ? ' active' : ''), type: 'button', onclick: () => { mode = 'login'; notice = null; draw(); } }, 'Вход'),
          h('button', { class: 'chip' + (mode === 'register' ? ' active' : ''), type: 'button', onclick: () => { mode = 'register'; notice = null; draw(); } }, 'Регистрация')),
        form,
        h('button', { class: 'btn ghost wide', type: 'button', onclick: () => resolve({ guest: true }) }, 'Играть без входа'),
        h('p', { class: 'muted small' }, 'Без входа прогресс остаётся только в этом браузере, а рейтинг недоступен.')));
    };
    draw();
  });
}
