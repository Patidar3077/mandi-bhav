# Mandi Bhav

Mandi (APMC) crop prices, nearby-mandi comparison, price forecasts and an AI chat for farmers around Mumbai and across Maharashtra, in English, Hindi and Marathi. Free for everyone, with no sign-up or login. Built by Dhamedi Agro Solution.

Live: https://mandibhav.vercel.app

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind v4 on Vercel · Supabase Postgres (RLS) · Apify actor `themineworks/india-data-gov-scraper` → data.gov.in · Claude API · Recharts
- **Specs:** [`docs/PRD.md`](docs/PRD.md) is the original spec, [`docs/DESIGN.md`](docs/DESIGN.md) is the design system, and [`CLAUDE.md`](CLAUDE.md) holds the project rules. Since the PRD was written, login and the trial were dropped (see "No login" below).

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev
```

Open http://localhost:3000.

## Deploy

The Vercel project `mandibhav` is deployed with the Vercel CLI:

```bash
vercel deploy --prod --yes
```

## Keys

| Variable | Where it comes from |
|---|---|
| `APP_DB_SECRET` | A random string, which must equal `private.app_config` → `app_secret` in the database |
| `VISITOR_COOKIE_SECRET` | A random string (signs the visitor cookie) |
| `APIFY_TOKEN` | Apify Console → Settings → API & Integrations |
| `DATA_GOV_IN_API_KEY` | data.gov.in → sign in → My Account → API key (free) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `APIFY_WEBHOOK_SECRET`, `CRON_SECRET` | Random strings |

All of these are server-only. They are never sent to the browser.

## No login

- The first screen (`/welcome`) asks for a name and district (plus an optional mandi and language). That creates a row in `visitors`, and the app remembers it on the device with an HMAC-signed, httpOnly cookie (`mb_visitor`). "Use as a different person" on the profile page forgets it.
- **Database access.** The server uses the public anon key plus a private `x-app-secret` header. The RLS policy `"server only"` on every table allows a request only when that header matches `private.app_config.app_secret` (migration 0005). Browsers never have the secret, so they can't read or write anything directly.
- **Free, with hidden fair-use caps** (`lib/limits.ts`): 100 price checks and 200 chat messages per visitor per day, and 30 new visitors per IP per day. These stop abuse and runaway Apify/AI costs; real farmers won't hit them.

## How data flows

1. **Daily sync (Agmarknet, free).** Vercel Cron calls `/api/sync/daily/0` … `/3` at 14:00 and 21:00 IST (crops split into 4 groups so each run stays under the 5-minute limit). Each fetches today's and yesterday's Maharashtra prices from Agmarknet's public market-wise daily report (`lib/agmarknet.ts`). Only if Agmarknet fails completely does it start the Apify / data.gov.in run; Apify then calls `/api/sync/apify-webhook`, which upserts the rows. `/api/sync/agmarknet?from=1. **Daily sync.** Vercel Cron calls `/api/sync/daily` at 21:00 IST. It starts the Apify actor for `state=Maharashtra`. When the run finishes, Apify calls `/api/sync/apify-webhook`, which upserts the rows into `prices`.to=` backfills history.
   - Vercel Hobby allows one cron a day. For the 14:00 IST run, create a schedule in Apify for the same actor and input, and add a webhook on "Run succeeded" pointing to `https://<your-domain>/api/sync/apify-webhook?secret=<APIFY_WEBHOOK_SECRET>`. Scheduled runs are adopted automatically.
2. **Live fetch.** When a search has no price for today in that district, the app runs the actor for that crop and district. This is deduped for 60 minutes and gives up after about 90 seconds, showing the last stored price instead.
3. **Cost guard.** Every Apify call goes through `lib/apify.ts`, which applies `maxResults`, `maxTotalChargeUsd` (Apify's minimum is $0.50) and the daily cap `DAILY_APIFY_SPEND_CAP_USD`. Every run is logged in `sync_runs`.

## Code map

- `app/welcome`: name + district, no login
- `app/(app)/market`: crop and mandi selection with results
- `app/(app)/analysis/[commodity]`: charts, comparison, forecast, guidance and the docked chat
- `app/api/*`: prices, live fetch, chat (streams progress as NDJSON), insights, sync webhook and cron
- `lib/forecast/model.ts`: the statistical forecast (7-day moving average, 21-day linear trend, damped weeks 2–4, widening ranges). The AI never produces prices.
- `lib/ai/*`: Claude chat loop with 5 data tools, and cached summary/factor insights
- `lib/auth.ts`: visitor cookie. `lib/limits.ts` + the `consume_usage()` SQL function: fair-use caps
- `messages/{en,hi,mr}.json`: every user-facing string
- `supabase/migrations`: schema, RLS, seed data (crop names in 3 languages, Maharashtra district neighbours)
