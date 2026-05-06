-- Single word — Fase 3: plan / pago en profiles (Supabase)
-- Ejecutar en Supabase → SQL Editor después de 001_phase1_profiles.sql

alter table public.profiles
  add column if not exists plan text not null default 'free';

alter table public.profiles
  add column if not exists paid boolean not null default false;

alter table public.profiles
  add column if not exists paid_until timestamptz;

alter table public.profiles
  add column if not exists lemon_customer_id text;

alter table public.profiles
  add column if not exists lemon_subscription_id text;

comment on column public.profiles.plan is 'free | pro (ampliable)';
comment on column public.profiles.paid is 'Acceso de pago; solo el backend (service_role) debe cambiarlo.';
comment on column public.profiles.paid_until is 'Opcional: fin de periodo pagado';

-- Evita que un usuario con JWT "authenticated" se auto-asigne paid/plan desde el cliente.
create or replace function public.profiles_guard_billing_columns()
returns trigger
language plpgsql
as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '');
  db_user text := current_user;
begin
  if jwt_role = 'service_role' or db_user = 'service_role' or db_user = 'postgres' then
    return NEW;
  end if;
  if tg_op = 'UPDATE' then
    if new.paid is distinct from old.paid
       or new.plan is distinct from old.plan
       or new.paid_until is distinct from old.paid_until
       or new.lemon_customer_id is distinct from old.lemon_customer_id
       or new.lemon_subscription_id is distinct from old.lemon_subscription_id then
      raise exception 'billing fields are server-only';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_billing on public.profiles;
create trigger profiles_guard_billing
  before update on public.profiles
  for each row execute function public.profiles_guard_billing_columns();
