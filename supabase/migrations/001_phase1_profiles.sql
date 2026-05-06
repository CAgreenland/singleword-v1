-- Single word — Fase 1: perfiles enlazados a auth.users + RLS
-- Ejecutar en Supabase → SQL Editor (una vez por proyecto).

-- 1) Tabla de perfil (1 fila por usuario)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

comment on table public.profiles is 'Perfil mínimo; amplía con plan, lemon_customer_id, etc. en fases siguientes.';

-- 2) Al registrarse un usuario en Auth, crear fila en profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) RLS
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Inserts solo vía trigger (security definer); el cliente no inserta profiles directamente en Fase 1.
