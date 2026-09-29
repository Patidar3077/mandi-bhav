@AGENTS.md

# CLAUDE.md

Read docs/PRD.md before starting any task. It's the source of truth for this project. The design system is docs/DESIGN.md.

## Project

Mandi Bhav AI: a web app for farmers around Mumbai and nearby Maharashtra mandis to check crop prices, compare mandis, see forecasts and chat with an AI about prices. English, Hindi and Marathi.

## Stack

- Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel
- Supabase for auth (email OTP for now; phone OTP once an SMS provider + DLT is ready) and Postgres
- Apify actor `themineworks/india-data-gov-scraper` for mandi prices (data.gov.in resource `9ef84268-d588-465a-a308-a864a43d0070`)
- Claude API for the chatbot and plain-language explanations
- Recharts for graphs; a small built-in translation layer (`lib/i18n`, `messages/en|hi|mr.json`) instead of next-intl

## Hard rules

- Never let the AI invent a price. Every price the chatbot states must come from a tool that reads our database or runs the Apify fetch. If there's no data, it says so.
- Forecast numbers come only from the statistical model in `lib/forecast` (moving average + damped linear trend, see PRD section 6). The AI only explains them.
- Every forecast shown in the UI or chat includes the disclaimer that it's an estimate, not a guaranteed price.
- Every price shown has its date next to it.
- API keys (Apify, data.gov.in, Anthropic, Supabase service role) are used only in server code. Never import them in client components or expose them with `NEXT_PUBLIC_`.
- Apify calls always go through one helper in `lib/apify.ts` that applies dedupe (60 min), `maxResults`, `maxTotalChargeUsd` and the daily spend cap, and logs to `sync_runs`.
- Usage limits and trial checks run on the server.
- Prices are stored per quintal as the data gives them. Convert to per kg only for display.
- Every user-facing string goes through the translation files. No hardcoded English text in components.

## How to work

- Follow the build order in PRD section 11. Finish and test one step before starting the next.
- Keep changes small. After each working step, remind me to commit to GitHub.
- When you change the database, write a new migration file in `supabase/migrations` instead of editing old ones.
- Before building anything that depends on the Apify data shape, run a small test fetch (`state=Maharashtra`, `commodity=Onion`, `maxResults=20`) and check the real field names.
- If something in the PRD is unclear or looks wrong, ask me before guessing.
- Design for phones first. Big buttons, simple words, works on slow connections.

## Folder layout (suggested)

- `app/` pages: `(auth)/login`, `onboarding`, `market`, `analysis/[commodity]`
- `app/api/` routes: `prices`, `live-fetch`, `forecast`, `chat`, `sync/apify-webhook`
- `lib/` helpers: `apify.ts`, `supabase/`, `forecast/`, `limits.ts`, `ai/tools.ts`
- `messages/` translation files: `en.json`, `hi.json`, `mr.json`
- `supabase/migrations/` SQL migrations
