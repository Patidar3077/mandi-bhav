-- Distinct crops seen in the price data (so crops missing from `commodities` still show up in English)
create view public.price_commodities
with (security_invoker = on) as
  select distinct commodity from public.prices;

-- Cached AI summary + price factors for the analysis page (one per crop/place/day/language)
create table public.ai_insights (
  id bigint generated always as identity primary key,
  commodity text not null,
  district text not null,
  market text not null default '',
  insight_date date not null,
  language text not null check (language in ('en', 'hi', 'mr')),
  summary text not null,
  factors jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (commodity, district, market, insight_date, language)
);
alter table public.ai_insights enable row level security;
create policy "read insights" on public.ai_insights for select to authenticated using (true);
