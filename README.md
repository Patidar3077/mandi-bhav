# Mandi Bhav

Mandi (APMC) crop prices, nearby-mandi comparison, price forecasts and an AI chat for farmers around Mumbai and across Maharashtra, in English, Hindi and Marathi. Built by Dhamedi Agro Solution.

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind v4 on Vercel · Supabase (Postgres, auth, RLS) · Apify actor `themineworks/india-data-gov-scraper` → data.gov.in · Claude API · Recharts
- **Specs:** [`docs/PRD.md`](docs/PRD.md) is the source of truth, [`docs/DESIGN.md`](docs/DESIGN.md) is the design system, and [`CLAUDE.md`](CLAUDE.md) holds the project rules.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev
```

Open http://localhost:3000.

## Keys you need to add

| Variable | Where to get it |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → `service_role` (secret) |
| `APIFY_TOKEN` | Apify Console → Settings → API & Integrations |
| `DATA_GOV_IN_API_KEY` | data.gov.in → sign in → My Account → API key (free) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `APIFY_WEBHOOK_SECRET`, `CRON_SECRET` | Any long random string |

All of these are server-only. They are never sent to the browser.

## How data flows

1. **Daily sync.** Vercel Cron calls `/api/sync/daily` at 21:00 IST. It starts the Apify actor for `state=Maharashtra`. When the run finishes, Apify calls `/api/sync/apify-webhook`, which upserts the rows into `prices`.
   - Vercel Hobby allows one cron a day. For the 14:00 IST run, create a schedule in Apify for the same actor and input, and add a webhook on "Run succeeded" pointing to `https://<your-domain>/api/sync/apify-webhook?secret=<APIFY_WEBHOOK_SECRET>`. Scheduled runs are adopted automatically.
2. **Live fetch.** When a search has no price for today in that district, the app runs the actor for that crop and district. This is deduped for 60 minutes and gives up after about 90 seconds, showing the last stored price instead.
3. **Cost guard.** Every Apify call goes through `lib/apify.ts`, which applies `maxResults`, `maxTotalChargeUsd` (Apify's minimum is $0.50) and the daily cap `DAILY_APIFY_SPEND_CAP_USD`. Every run is logged in `sync_runs`.

## Code map

- `app/(app)/market`: crop and mandi selection with results
- `app/(app)/analysis/[commodity]`: charts, comparison, forecast, guidance and the docked chat
- `app/api/*`: prices, live fetch, chat (streams progress as NDJSON), insights, sync webhook and cron
- `lib/forecast/model.ts`: the statistical forecast (7-day moving average, 21-day linear trend, damped weeks 2–4, widening ranges). The AI never produces prices.
- `lib/ai/*`: Claude chat loop with 5 data tools, and cached summary/factor insights
- `lib/limits.ts` + the `consume_usage()` SQL function: trial and daily limits, enforced on the server
- `messages/{en,hi,mr}.json`: every user-facing string
- `supabase/migrations`: schema, RLS, seed data (crop names in 3 languages, Maharashtra district neighbours)

## Login

People sign in with a 6-digit code sent to their own email, the first time on each phone or computer. After that they stay signed in until they sign out.

- **App-sent code (recommended).** Set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (and optionally `EMAIL_FROM`). `/api/auth/send-code` creates the account on first login, gets the code from Supabase (`auth.admin.generateLink`) and emails it in the user's language. It's rate-limited per email (30s apart, 5 an hour) and per IP (20 an hour).
  - Gmail: turn on 2-step verification, create an App Password at https://myaccount.google.com/apppasswords, then use `smtp.gmail.com`, port `465`.
- **Fallback.** Without SMTP settings, Supabase sends the email. Its free sender only allows a few emails an hour, and its default templates contain a link but no code. To include the code, add `{{ .Token }}` to Supabase → Authentication → Email Templates → "Confirm signup" and "Magic Link".

Phone OTP needs an SMS provider plus Indian DLT registration; add it later in Supabase → Authentication → Providers → Phone.
