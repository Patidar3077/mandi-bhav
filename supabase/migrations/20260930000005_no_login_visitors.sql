-- No login: people just enter their name and district. The app remembers them with a signed cookie.
-- The server reaches the database with the public anon key plus a private `x-app-secret` header;
-- RLS lets a request through only when that header matches the secret stored in `private.app_config`
-- (inserted separately, never committed). Browsers never have the secret, so they get nothing.

create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.app_config (
  key text primary key,
  value text not null
);
revoke all on private.app_config from public, anon, authenticated;

create or replace function private.is_server()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (current_setting('request.headers', true)::json ->> 'x-app-secret')
      = (select value from private.app_config where key = 'app_secret'),
    false
  );
$$;
grant usage on schema private to anon, authenticated;
revoke all on function private.is_server() from public;
grant execute on function private.is_server() to anon, authenticated;

-- Visitors replace login accounts --------------------------------------------
create table public.visitors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text not null default 'Mumbai',
  preferred_market text,
  language text not null default 'en' check (language in ('en', 'hi', 'mr')),
  ip text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index visitors_ip_created on public.visitors (ip, created_at desc);
alter table public.visitors enable row level security;

-- Activity now belongs to a visitor instead of an auth user.
alter table public.searches drop constraint if exists searches_user_id_fkey;
alter table public.usage_daily drop constraint if exists usage_daily_user_id_fkey;
alter table public.chat_messages drop constraint if exists chat_messages_user_id_fkey;
alter table public.searches add constraint searches_visitor_fkey foreign key (user_id) references public.visitors (id) on delete cascade;
alter table public.usage_daily add constraint usage_daily_visitor_fkey foreign key (user_id) references public.visitors (id) on delete cascade;
alter table public.chat_messages add constraint chat_messages_visitor_fkey foreign key (user_id) references public.visitors (id) on delete cascade;

-- Server-only access to every app table --------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'visitors', 'commodities', 'markets', 'district_neighbours', 'prices', 'searches', 'usage_daily',
    'chat_messages', 'predictions', 'sync_runs', 'ai_insights', 'login_code_sends'
  ] loop
    execute format('create policy "server only" on public.%I for all to anon using (private.is_server()) with check (private.is_server())', t);
  end loop;
end $$;

-- The usage counter may now be called with the anon key, but only by the server.
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
  if not private.is_server() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not allowed';
  end if;

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
grant execute on function public.consume_usage(uuid, text, integer) to anon;
