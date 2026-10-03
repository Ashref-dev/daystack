begin;

create table if not exists public.folio_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision integer not null default 1 check (revision >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.folio_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (length(endpoint) between 1 and 2048),
  keys jsonb not null check (jsonb_typeof(keys) = 'object'),
  timezone text not null check (length(timezone) between 1 and 100),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists folio_push_subscriptions_user_idx
  on public.folio_push_subscriptions(user_id);

create table if not exists public.folio_reminder_receipts (
  subscription_id uuid not null references public.folio_push_subscriptions(id) on delete cascade,
  reminder_key text not null check (length(reminder_key) = 64),
  status text not null default 'claimed' check (status in ('claimed', 'delivered', 'failed')),
  claimed_at timestamptz not null default now(),
  delivered_at timestamptz,
  primary key (subscription_id, reminder_key)
);

alter table public.folio_backups enable row level security;
alter table public.folio_push_subscriptions enable row level security;
alter table public.folio_reminder_receipts enable row level security;

drop policy if exists folio_backups_owner on public.folio_backups;
create policy folio_backups_owner on public.folio_backups
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists folio_push_owner on public.folio_push_subscriptions;
create policy folio_push_owner on public.folio_push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.folio_backups, public.folio_push_subscriptions,
  public.folio_reminder_receipts from anon, authenticated;
grant select, insert, update, delete on public.folio_backups,
  public.folio_push_subscriptions to authenticated;
grant select, insert, update, delete on public.folio_backups,
  public.folio_push_subscriptions, public.folio_reminder_receipts to service_role;

commit;
