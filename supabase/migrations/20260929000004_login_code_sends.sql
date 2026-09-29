-- Log of login-code emails sent by the app (server-only), used to rate-limit sends.
create table public.login_code_sends (
  id bigint generated always as identity primary key,
  email text not null,
  ip text,
  sent_at timestamptz not null default now()
);
create index login_code_sends_email on public.login_code_sends (email, sent_at desc);
create index login_code_sends_ip on public.login_code_sends (ip, sent_at desc);
alter table public.login_code_sends enable row level security;
-- No policies: only the service role (server) reads or writes this table.
