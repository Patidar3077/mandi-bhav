# PRD: Mandi Bhav AI (working name)

AI-based crop and vegetable market price analysis and prediction for farmers in the Mumbai region and nearby Maharashtra mandis.

Version 1.0 (MVP) · Last updated: 29 Sep 2026

---

## 1. What we're building

A mobile-friendly web app where a farmer can:

- check today's mandi price for any crop or vegetable
- compare it with yesterday and the day before
- see which nearby mandis are paying more right now
- see where prices are heading over the next 7 days and the next 2-4 weeks
- ask an AI chatbot questions about prices in English, Hindi or Marathi

The goal is simple: help a farmer decide where and when to sell. Every forecast is an estimate from market data, never a promise, and the app says so every time it shows one.

### Who it's for

Farmers and small traders around Mumbai who sell into mandis in Mumbai, Thane, Raigad, Palghar, Pune, Nashik, Ahmednagar and other Maharashtra districts. Most will use a phone, often on a slow connection, and many will prefer Marathi or Hindi over English.

### What's in the MVP and what isn't

| In MVP | Later |
|---|---|
| Phone number + OTP login | Paid subscription and payments |
| 7-day free trial (unlimited), then free limits | Price alerts (SMS / WhatsApp) |
| English, Hindi, Marathi | Advanced market reports / PDF export |
| All crops available in the data source for Maharashtra | Other states |
| Daily data sync + live fetch for missing data | Weather and arrival-volume factors in the forecast |
| 7-day and 2-4 week forecasts | Mobile app (Play Store) |
| AI chatbot with live data access | Voice input |

---

## 2. Data source

### 2.1 Where prices come from

Prices come from data.gov.in (Agmarknet mandi data), fetched through the Apify actor `themineworks/india-data-gov-scraper`.

| Item | Value |
|---|---|
| Apify actor | `themineworks/india-data-gov-scraper` |
| data.gov.in dataset | "Current Daily Price of Various Commodities from Various Markets (Mandi)" |
| Resource ID | `9ef84268-d588-465a-a308-a864a43d0070` |
| Actor inputs | `resourceId` (required), `apiKey` (our own free data.gov.in key), `filters` (array of `field=value` strings), `maxResults` |
| Example filter | `["state=Maharashtra", "district=Pune", "commodity=Onion"]` |
| Apify cost (free tier) | about $0.005 per run + $0.002 per record returned |

Expected fields in each record (confirm against a real run before building the schema): `state`, `district`, `market`, `commodity`, `variety`, `grade`, `arrival_date`, `min_price`, `max_price`, `modal_price`. Prices are in ₹ per quintal. The app should also show ₹ per kg (divide by 100) because farmers selling vegetables often think in kg.

The data.gov.in API is heavily rate-limited without a key, so we register our own free key and pass it as `apiKey` on every run.

### 2.2 The history problem

This dataset mostly holds the latest day's prices, not a long history. So the app has to build its own history by saving every day's prices into Supabase. That's what the daily sync is for.

What this means in practice:

- On launch day we only have one day of data. "Yesterday" and "day before" will show "not available yet" until the sync has run for 2-3 days.
- Forecasts need more history (see section 6). Until there's enough, the app shows the current price and trend but hides the forecast with a clear message.
- Optional but strongly recommended: find a data.gov.in or Agmarknet historical dataset for Maharashtra and do a one-time backfill of the last 6-12 months. This makes the forecast useful from week one. This needs its own resource ID and has to be checked before building.

### 2.3 How data gets into the app (hybrid)

1. **Daily sync.** A scheduled job calls the Apify actor with `filters: ["state=Maharashtra"]` and saves every row into the `prices` table. It upserts on (arrival_date, market, commodity, variety, grade) so re-runs don't create duplicates.
   - Run it twice a day: around 2:00 PM IST and 9:00 PM IST, since mandis report at different times.
   - Vercel's Hobby plan only allows cron jobs once a day. Options: upgrade to Pro, or use Apify's own scheduler to run the actor and call a webhook on our app when it finishes (`/api/sync/apify-webhook`). The webhook route is the better choice because the Apify run can take longer than a Vercel function timeout.
   - Log every run in `sync_runs` (start time, rows saved, cost, errors).

2. **Live fetch.** When a farmer searches a crop + district (or the chatbot needs one) and there's no row for today, the app calls the actor right away with filters for state, district and commodity, saves the result, and shows it.
   - Show a loading state ("Getting today's price from the mandi…") because this can take 10-30 seconds.
   - Dedupe: if the same crop + district was live-fetched in the last 60 minutes, don't call Apify again, just use what we have.
   - If Apify fails or returns nothing, show the latest price we have with its date ("Last reported price: 27 Sep").

3. **Cost guard.** Every Apify call from our server passes `maxTotalChargeUsd` in call options and a sensible `maxResults`. Add a daily spend cap in app settings (for example $5/day). If it's hit, live fetch pauses and the app serves stored data only. Admin gets an email.

Rough cost: a full Maharashtra pull of N rows costs about N × $0.002 + $0.005. For example, 2,000 rows is about $4 per sync. Measure the real row count on the first run and set the cap from that.

### 2.4 Crop names

The data uses English names ("Onion", "Tomato", "Soyabean", "Brinjal"). Farmers will search in their own language. Keep a `commodities` table that maps each data name to Hindi and Marathi names and common spellings, for example:

| Data name | English | Hindi | Marathi |
|---|---|---|---|
| Onion | Onion | प्याज | कांदा |
| Tomato | Tomato | टमाटर | टोमॅटो |
| Potato | Potato | आलू | बटाटा |
| Wheat | Wheat | गेहूं | गहू |
| Soyabean | Soybean | सोयाबीन | सोयाबीन |
| Brinjal | Brinjal | बैंगन | वांगी |

Search should match any of these, plus small typos. Crops that exist in the data but aren't in the table yet still show up in English.

---

## 3. Nearby mandis

The farmer picks their district when signing up (they can change it later). "Nearby mandis" means every mandi in that district plus the neighbouring districts.

- Store district neighbours in a `district_neighbours` table. Seed it for Maharashtra (for example Thane → Mumbai, Mumbai Suburban, Palghar, Raigad, Pune, Nashik, Ahmednagar).
- Default district for new users: Mumbai.
- Mandi names come from the data itself, so the list grows as the sync runs.
- The farmer can also mark one mandi as their "preferred mandi". It shows first everywhere.

---

## 4. Users, login and limits

### 4.1 Login

- Phone number + OTP through Supabase Auth.
- Supabase needs an SMS provider (Twilio, MessageBird, Vonage or a similar one that supports Indian numbers). Sending SMS OTP in India needs DLT registration of the sender ID and message template. Budget time for this, it can take a couple of weeks.
- After the first login, a short onboarding: name (optional), language, district, preferred mandi (optional).

### 4.2 Free trial and limits

| Stage | Crop searches | AI chat messages |
|---|---|---|
| Days 1-7 (trial) | Unlimited* | Unlimited* |
| After day 7 (free) | 5 per day | 10 per day |
| Paid (later) | Higher / unlimited | Higher / unlimited |

\*Unlimited for the farmer, but with a hidden fair-use cap to stop abuse and runaway Apify/AI costs, for example 100 searches and 200 chat messages per day. The farmer never sees this unless they hit it.

- A "search" is one "Check Market Price" or one "Analyze Market" on a new crop + district. Reopening the same crop the same day doesn't count again.
- Limits reset at midnight IST.
- Trial end date and daily counts are enforced on the server, never only in the browser.
- When a limit is hit, show a friendly message in the user's language with the reset time. Add a "Paid plans coming soon" note so we can measure interest.

---

## 5. Screens

All screens: mobile-first, big tap targets, language switch in the header (EN / हिं / मरा), works on slow 3G. Numbers always in ₹ with Indian formatting (₹1,25,000).

### 5.1 Login

- Phone number field (+91 prefilled), "Send OTP" button.
- 6-digit OTP entry, resend after 30 seconds.
- Language picker on this screen too, so a farmer who doesn't read English can log in.
- First login → onboarding (language, district, preferred mandi).
- Show trial status after login ("Free trial: 6 days left").

### 5.2 Crop & market selection

Top section:
- Crop search box with suggestions in all three languages, plus a row of quick picks (onion, tomato, potato, wheat, soybean, and the farmer's recent searches).
- District selector (defaults to the farmer's district).
- Mandi selector (defaults to preferred mandi, or "All nearby mandis").
- "Check Market Price" button.

Results card for the selected crop and mandi:

| Field | Notes |
|---|---|
| Today's price (modal) | Big number, ₹/quintal and ₹/kg |
| Yesterday's price | Or "not reported" |
| Day before yesterday | Or "not reported" |
| Minimum price | Today's min |
| Maximum price | Today's max |
| Average price | Average of modal prices across nearby mandis today |
| Change vs yesterday | ₹ and %, green up arrow / red down arrow |
| Date of data | Always visible ("Prices for 29 Sep 2026") |

Nearby mandis table: every nearby mandi with today's modal price, min, max, change from yesterday. Sorted highest price first. The best one gets a "Best price today" tag.

"Mandi didn't report today" is common. When a mandi has no row for today, show its last price with the date in grey instead of hiding it.

"Analyze Market" button at the bottom.

### 5.3 Price analysis, prediction & AI chat

Sections from top to bottom:

1. **Summary card.** Current price, change vs yesterday, trend label (Rising / Falling / Stable), and one plain-language line from the AI, for example "Onion prices in Pune are up 8% this week and still rising."
2. **Price trend graph.** Line chart of modal price with a toggle for 7 / 30 / 90 days (only show ranges we have data for). Forecast shown as a dotted line with a shaded range.
3. **Historical comparison.** Today vs 7 days ago, 30 days ago, and 30-day average.
4. **Market comparison.** Bar chart of today's price across nearby mandis.
5. **Forecast.**
   - Next 7 days: expected price range for each day.
   - Next 2-4 weeks: one expected range per week.
   - Confidence label (High / Medium / Low) based on how much data we have and how jumpy prices have been.
   - If there isn't enough data: "We need more price history before we can forecast this crop here. Check back in X days."
6. **Selling guidance.** Better-priced mandis right now, a possible better selling window if the forecast shows one, and factors that may move the price (season, festival demand, rain, arrivals). Factors come from the AI and must be worded as possibilities, not facts.
7. **Disclaimer**, always visible near the forecast: "This is an estimate based on past market prices. It's not a guaranteed future price. Please check with your mandi before selling." (shown in the user's language).

AI chat: floating button at the bottom right. Opens a chat panel over the page. Details in section 7.

---

## 6. Forecast method

The numbers come from a simple statistical model that runs in our code. The AI never makes up a price. It only explains numbers the model produced.

### 6.1 Inputs

Daily modal price for one crop at one mandi (or the average across nearby mandis if one mandi's data is too thin). Missing days are filled by carrying the last price forward, capped at 3 days; longer gaps are left empty.

### 6.2 Method

1. Smooth the series with a 7-day moving average.
2. Fit a straight-line trend (linear regression) on the last 21 days of the smoothed series. The slope gives direction and speed.
3. Project the line forward for the 7-day forecast (one value per day) and 2-4 weeks (one value per week). Damp the trend for longer horizons, for example use 70% of the slope for weeks 2-4, so it doesn't run away.
4. Range = projected value ± (1.5 × standard deviation of daily price changes over the last 30 days × √days ahead). The range gets wider the further out we go.
5. Never show a negative price. Clip the low end at a sensible floor (for example 30% of the current price).

### 6.3 Trend label

- Rising: 7-day smoothed change above +3%
- Falling: below -3%
- Stable: between -3% and +3%

### 6.4 When to show a forecast

| Forecast | Minimum history needed |
|---|---|
| 7-day | 21 days of prices, with at least 15 real (not filled) days |
| 2-4 week | 60 days of prices, with at least 40 real days |

Confidence: High if volatility is low and history is long, Low if prices jumped more than 20% in a day recently or history is just above the minimum, Medium otherwise.

Save every forecast to `predictions` (crop, mandi, date made, horizon, predicted range, method version). Later, compare with real prices to measure accuracy. This tells us when the simple model isn't good enough and we need something better.

---

## 7. AI chatbot

### 7.1 Model and setup

- Claude API (current Sonnet model, model name set in env so it can be changed).
- Called only from our server. API key never goes to the browser.
- Replies in the language the farmer writes in (English, Hindi or Marathi, including Hindi/Marathi typed in English letters).
- Short, simple answers. Numbers in ₹ with the date of the data.

### 7.2 Tools the chatbot can use

The chatbot gets data through tools that read our database or trigger a fetch. It has no other source of prices.

| Tool | What it does |
|---|---|
| `get_latest_price(commodity, market?, district?)` | Today's / latest price with date |
| `get_price_history(commodity, market?, district?, days)` | Daily prices for the last N days |
| `compare_markets(commodity, district)` | Today's price across nearby mandis |
| `get_forecast(commodity, market?, district?)` | Output of our forecast model, or "not enough data" |
| `fetch_live_prices(commodity, district)` | Runs the Apify live fetch (same dedupe and cost guard as section 2.3), saves results, returns them |

Flow when the farmer asks about a crop we don't have: the chatbot calls `fetch_live_prices`, the UI shows "Checking mandi prices…", and then it answers from what came back. If nothing came back, it says so plainly.

### 7.3 Rules for the chatbot (goes in the system prompt)

- Only state prices that came from a tool result. If there's no data, say "I don't have a price for that yet" and don't guess.
- Always mention the date of the price.
- For future prices, only use `get_forecast`, give it as a range, and include the disclaimer.
- Don't give personal financial or legal advice. It can explain the numbers and point out better-priced mandis.
- Stay on topic: crops, mandi prices, selling. Politely decline unrelated requests.
- Default to the farmer's district unless they name another place.

### 7.4 Example questions it must handle

- "What is today's onion price?"
- "How much has tomato increased since yesterday?"
- "Which nearby mandi has the highest soybean price?"
- "Show me the price of wheat for the last 7 days."
- "What is the expected tomato price next week?"
- "Is the current market trend increasing or decreasing?"
- "Compare today's price with the last 30 days."
- "आज कांद्याचा भाव काय आहे?" (Marathi)
- "पुणे में टमाटर का भाव कितना है?" (Hindi)

### 7.5 Limits and history

- Each message sent by the farmer counts as one chat message (see limits in 4.2).
- Keep the last 20 messages of a conversation as context. Save chats in `chat_messages` so the farmer can scroll back.

---

## 8. Tech stack

| Part | Tool |
|---|---|
| Frontend + API routes | Next.js (App Router) + TypeScript + Tailwind, hosted on Vercel |
| Auth + database | Supabase (Postgres, phone OTP, Row Level Security) |
| Mandi data | Apify actor `themineworks/india-data-gov-scraper` → data.gov.in |
| AI | Claude API (server-side only) |
| Charts | Recharts |
| Translations | next-intl (or similar), with en / hi / mr message files |
| Version control | GitHub, with a commit or tag at every working checkpoint |

### 8.1 Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `APIFY_TOKEN` (server only)
- `DATA_GOV_IN_API_KEY` (server only)
- `ANTHROPIC_API_KEY` (server only)
- `CLAUDE_MODEL`
- `APIFY_WEBHOOK_SECRET` (to verify sync webhooks)
- `DAILY_APIFY_SPEND_CAP_USD`

---

## 9. Database (Supabase)

| Table | What it holds |
|---|---|
| `profiles` | user id, phone, name, language, district, preferred mandi, trial_ends_at, plan |
| `commodities` | data name, English / Hindi / Marathi names, search aliases |
| `markets` | market name, district, state (filled from data) |
| `district_neighbours` | district, neighbour district |
| `prices` | arrival_date, state, district, market, commodity, variety, grade, min_price, max_price, modal_price, source (sync / live), fetched_at. Unique on (arrival_date, market, commodity, variety, grade) |
| `searches` | user, commodity, district, market, created_at (also used for counting limits) |
| `usage_daily` | user, date, searches_used, chats_used |
| `predictions` | commodity, market/district, made_on, horizon, predicted low / mid / high, confidence, method_version |
| `chat_messages` | user, conversation id, role, content, created_at |
| `sync_runs` | type (daily / live), filters, started_at, finished_at, rows_saved, apify_run_id, cost_usd, error |

Row Level Security: users can read and write only their own `profiles`, `searches`, `usage_daily`, `chat_messages`. Price, market and commodity tables are readable by any logged-in user and writable only by the server.

Add indexes on `prices (commodity, district, arrival_date)` and `prices (commodity, market, arrival_date)`.

---

## 10. Non-functional requirements

- Crop page loads in under 3 seconds on 4G when data is already stored.
- Live fetch shows progress and times out gracefully after 45 seconds.
- All secret keys stay on the server.
- Every price shown has its date next to it.
- Basic error tracking (Vercel logs at minimum, Sentry if possible).
- Works on Chrome for Android from the last 3 years.

---

## 11. Build plan (for vibe coding)

Build in this order and commit to GitHub after each step works:

1. Next.js project, Supabase connected, deployed to Vercel with a hello page.
2. Database tables and seed data (commodities, Maharashtra district neighbours).
3. Apify integration: one server function that runs the actor with filters and saves rows. Test with `state=Maharashtra, commodity=Onion`.
4. Daily sync (Apify schedule + webhook, or Vercel cron) and `sync_runs` logging.
5. Phone OTP login and onboarding.
6. Crop & market selection page with live-fetch fallback.
7. Analysis page: charts, comparisons, trend label.
8. Forecast model + saving predictions.
9. AI chatbot with tools.
10. Trial and usage limits.
11. Hindi and Marathi translations.
12. Cost guard, error states, polish, testing on a real phone.

---

## 12. Success measures

- Farmers who come back at least 3 times in their first week.
- Share of searches answered from stored data vs live fetch (aim for most from stored data after the first month).
- Forecast accuracy: how often the real price lands inside the predicted 7-day range (target 70%+ once there's 90 days of history).
- Apify + AI cost per active user per month.
- How many free users hit their daily limit (interest in paid plans).

---

## 13. Open questions and risks

- Mumbai-area mandi coverage in the data can be patchy, and some mandis skip days. Check real data for the main crops and mandis before launch.
- Exact dataset field names and date format need checking on the first real Apify run.
- A historical dataset for backfill needs to be found and its resource ID confirmed.
- SMS DLT registration timing for OTP.
- Real daily Apify cost once the Maharashtra row count is known.
- Paid plan prices and payment gateway (for example Razorpay) to be decided after the MVP.
