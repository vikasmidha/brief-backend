# BRIEF — backend + live data

This turns the BRIEF prototype from mock data into a real Node/Express backend
that pulls live news, market quotes, and weather, and serves grocery/fuel
prices from an editable data file. The frontend has been wired to call it —
if a key is missing or a call fails, the app silently falls back to the mock
content it shipped with, so it never breaks mid-setup.

## 1. What's real vs. what's placeholder

| Feature | Status |
|---|---|
| News (Trending) | ✅ Real — NewsAPI |
| Stock market strip | ✅ Real — Twelve Data |
| Weather-based mood | ✅ Real — OpenWeatherMap |
| Grocery / fuel prices | ⚠️ Backend-served, but from a manually-edited file (`data/manual-prices.json`) — there is no public API for retailer-level grocery/fuel pricing. Update the file (or wire it to a real vendor feed if you get one) to keep it current. |
| IPO, Startup, Funding, Politics | Same News pipeline, different query — real, but general search results rather than a dedicated feed |
| Ticket prices, Reels, Movie reviews, Fashion trends | Still mock/static in this version — no public API exists for cinema showtimes or curated trend content; these would need a licensed data provider or your own editorial team |
| Tap-to-pin, Save/Share, Settings toggles | Client-side only — not yet persisted to a user account. Add a database + auth if you want these to survive a reload/reinstall |

## 2. Get your API keys (all have free tiers)

- News: https://newsapi.org — sign up, copy the key
- Markets: https://twelvedata.com — sign up, copy the key
- Weather: https://openweathermap.org/api — sign up, copy the key (can take ~10 min to activate)

Copy `.env.example` to `.env` and paste your keys in:

```bash
cp .env.example .env
# then edit .env with your real keys
```

## 3. Run it locally

```bash
npm install
npm start
# open http://localhost:4000
```

Check `http://localhost:4000/health` — it tells you exactly which keys are missing.

## 4. Deploy it for real

I can't provision hosting accounts on your behalf, but this is a standard
Node app, so any of these work well and have free tiers:

**Render (recommended, easiest)**
1. Push this folder to a GitHub repo.
2. On https://render.com → New → Web Service → connect the repo.
3. Build command: `npm install` · Start command: `npm start`.
4. Add your `.env` values under Render's "Environment" tab (never commit `.env`).
5. Deploy — Render gives you a live `https://yourapp.onrender.com` URL.

**Railway** (https://railway.app) — same idea, also very quick from a GitHub repo.

**Fly.io / a VPS** — more control, more setup; only worth it once you outgrow the free tiers above.

Once deployed, `https://yourapp.onrender.com/health` should show all three keys as `true`.

## 5. Updating grocery/fuel prices

```bash
curl -X PUT https://yourapp.onrender.com/api/prices/grocery \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: <set ADMIN_TOKEN in your env vars>" \
  -d '{"items": [ ... same shape as data/manual-prices.json ... ]}'
```

Set an `ADMIN_TOKEN` value in your hosting provider's environment variables —
without it, the update endpoint is locked and read-only.

## 6. Realistic next steps if you want to keep going

- A real database (Postgres via Render/Railway/Supabase) instead of the flat
  JSON file, once pin/save/settings need to persist per user.
- User accounts, if "your preferences" should follow you across devices.
- A scheduled job (cron) to pre-fetch news/markets on a timer instead of
  fetching on every page load — keeps you further under free-tier rate limits.
- A genuine ticket-price or grocery-price data partnership if those sections
  need to be truly live — there's no ethical shortcut around scraping retailer
  sites that don't offer a public feed.
