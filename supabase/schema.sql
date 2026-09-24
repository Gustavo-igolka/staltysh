-- Запусти целиком в Supabase → SQL Editor. Безопасно запускать повторно.
-- Все таблицы с префиксом shooter_, чтобы не пересекаться с другими твоими приложениями в этом же проекте.

-- Ники игроков (уникальные, видны всем — нужны для таблицы рейтинга)
create table if not exists public.shooter_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nickname   text not null unique check (char_length(nickname) between 3 and 20),
  created_at timestamptz not null default now()
);
alter table public.shooter_profiles enable row level security;

drop policy if exists "shooter_profiles read"   on public.shooter_profiles;
drop policy if exists "shooter_profiles insert" on public.shooter_profiles;
drop policy if exists "shooter_profiles update" on public.shooter_profiles;
create policy "shooter_profiles read"   on public.shooter_profiles for select using (true);
create policy "shooter_profiles insert" on public.shooter_profiles for insert with check (auth.uid() = user_id);
create policy "shooter_profiles update" on public.shooter_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Облачное сохранение игрока (одно на аккаунт)
create table if not exists public.shooter_saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  version    int  not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.shooter_saves enable row level security;

drop policy if exists "shooter_saves select" on public.shooter_saves;
drop policy if exists "shooter_saves insert" on public.shooter_saves;
drop policy if exists "shooter_saves update" on public.shooter_saves;
create policy "shooter_saves select" on public.shooter_saves for select using (auth.uid() = user_id);
create policy "shooter_saves insert" on public.shooter_saves for insert with check (auth.uid() = user_id);
create policy "shooter_saves update" on public.shooter_saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Таблица рейтинга и функция отправки счёта с проверкой добавим на этапе «Рейтинг».
