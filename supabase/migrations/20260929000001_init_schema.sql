-- Mandi Bhav: core schema (PRD section 9)

-- Profiles --------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  email text,
  name text,
  language text not null default 'en' check (language in ('en', 'hi', 'mr')),
  district text not null default 'Mumbai',
  preferred_market text,
  onboarded boolean not null default false,
  trial_ends_at timestamptz not null default (now() + interval '7 days'),
  plan text not null default 'free' check (plan in ('free', 'paid')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone, email)
  values (new.id, new.phone, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Reference data --------------------------------------------------------
create table public.commodities (
  data_name text primary key,
  name_en text not null,
  name_hi text,
  name_mr text,
  aliases text[] not null default '{}',
  is_quick_pick boolean not null default false
);

create table public.markets (
  id bigint generated always as identity primary key,
  market text not null,
  district text not null,
  state text not null default 'Maharashtra',
  unique (market, district)
);

create table public.district_neighbours (
  district text not null,
  neighbour text not null,
  primary key (district, neighbour)
);

-- Prices ----------------------------------------------------------------
create table public.prices (
  id bigint generated always as identity primary key,
  arrival_date date not null,
  state text not null,
  district text not null,
  market text not null,
  commodity text not null,
  variety text not null default '',
  grade text not null default '',
  min_price numeric(12, 2),
  max_price numeric(12, 2),
  modal_price numeric(12, 2) not null,
  source text not null default 'sync' check (source in ('sync', 'live', 'backfill')),
  fetched_at timestamptz not null default now(),
  unique (arrival_date, market, commodity, variety, grade)
);

create index prices_commodity_district_date on public.prices (commodity, district, arrival_date desc);
create index prices_commodity_market_date on public.prices (commodity, market, arrival_date desc);

-- Per-user activity -----------------------------------------------------
create table public.searches (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  commodity text not null,
  district text not null,
  market text,
  search_date date not null default ((now() at time zone 'Asia/Kolkata')::date),
  created_at timestamptz not null default now()
);
create index searches_user_date on public.searches (user_id, search_date);

create table public.usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  searches_used integer not null default 0,
  chats_used integer not null default 0,
  primary key (user_id, usage_date)
);

create table public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index chat_messages_user_conv on public.chat_messages (user_id, conversation_id, created_at);

-- Forecasts & sync logs -------------------------------------------------
create table public.predictions (
  id bigint generated always as identity primary key,
  commodity text not null,
  market text,
  district text,
  made_on date not null,
  horizon text not null,          -- e.g. 'd1'..'d7', 'w2'..'w4'
  target_date date not null,
  predicted_low numeric(12, 2) not null,
  predicted_mid numeric(12, 2) not null,
  predicted_high numeric(12, 2) not null,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  method_version text not null,
  created_at timestamptz not null default now(),
  unique (commodity, market, district, made_on, horizon, method_version)
);

create table public.sync_runs (
  id bigint generated always as identity primary key,
  type text not null check (type in ('daily', 'live', 'webhook')),
  filters jsonb not null default '[]',
  filter_key text,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_saved integer not null default 0,
  apify_run_id text,
  cost_usd numeric(10, 4) not null default 0,
  error text
);
create index sync_runs_filter_key on public.sync_runs (filter_key, started_at desc);
create index sync_runs_started on public.sync_runs (started_at desc);

-- Atomic usage counter (server-only) ------------------------------------
create or replace function public.consume_usage(p_user uuid, p_kind text, p_limit integer)
returns table (allowed boolean, used integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  current_used integer;
begin
  insert into public.usage_daily (user_id, usage_date)
  values (p_user, today)
  on conflict (user_id, usage_date) do nothing;

  if p_kind = 'search' then
    select u.searches_used into current_used from public.usage_daily u
      where u.user_id = p_user and u.usage_date = today for update;
    if current_used >= p_limit then
      return query select false, current_used; return;
    end if;
    update public.usage_daily set searches_used = searches_used + 1
      where user_id = p_user and usage_date = today;
  elsif p_kind = 'chat' then
    select u.chats_used into current_used from public.usage_daily u
      where u.user_id = p_user and u.usage_date = today for update;
    if current_used >= p_limit then
      return query select false, current_used; return;
    end if;
    update public.usage_daily set chats_used = chats_used + 1
      where user_id = p_user and usage_date = today;
  else
    raise exception 'unknown usage kind %', p_kind;
  end if;

  return query select true, current_used + 1;
end;
$$;

revoke execute on function public.consume_usage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.consume_usage(uuid, text, integer) to service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Row Level Security ----------------------------------------------------
alter table public.profiles enable row level security;
alter table public.commodities enable row level security;
alter table public.markets enable row level security;
alter table public.district_neighbours enable row level security;
alter table public.prices enable row level security;
alter table public.searches enable row level security;
alter table public.usage_daily enable row level security;
alter table public.chat_messages enable row level security;
alter table public.predictions enable row level security;
alter table public.sync_runs enable row level security;

create policy "own profile read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "own profile update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Users may only change their own settings, never trial or plan.
revoke update on public.profiles from authenticated, anon;
grant update (name, language, district, preferred_market, onboarded) on public.profiles to authenticated;

create policy "read commodities" on public.commodities for select to authenticated using (true);
create policy "read markets" on public.markets for select to authenticated using (true);
create policy "read neighbours" on public.district_neighbours for select to authenticated using (true);
create policy "read prices" on public.prices for select to authenticated using (true);
create policy "read predictions" on public.predictions for select to authenticated using (true);

-- Searches, usage and chat are written by the server only (limits are enforced there).
create policy "own searches read" on public.searches
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own usage read" on public.usage_daily
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own chat read" on public.chat_messages
  for select to authenticated using ((select auth.uid()) = user_id);
