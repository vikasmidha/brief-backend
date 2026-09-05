# BRIEF — backend + live data

This backend powers the BRIEF prototype with real news, market quotes, and weather, while grocery/fuel prices are served from an editable JSON file.

## 1. What's real vs. what's placeholder

| Feature | Status |
|---|---|
| News (Trending) | ✅ Real — NewsAPI |
| Stock market strip | ✅ Real — Yahoo Finance chart endpoint, server-side, no API key |
| Weather-based mood | ✅ Real — OpenWeatherMap |
| Grocery / fuel prices | ⚠️ Backend-served from `data/manual-prices.json` — not a live retailer feed |
| IPO, Startup, Funding, Politics | Same News pipeline, different query — real, but general search results rather than dedicated feeds |
| Ticket prices, Reels, Movie reviews, Fashion trends | Still mock/static — these need a suitable licensed/provider feed or editorial source |
| Tap-to-pin, Save/Share, Settings toggles | Client-side only — not yet persisted to a user account |

## 2. Market data — free setup

BRIEF no longer requires a Twelve Data key.

The market route uses Yahoo Finance's public chart endpoint server-side:

```text
https://query1.finance.yahoo.com/v8/finance/chart/{symbol}
```

Symbols currently used:

| BRIEF | Yahoo symbol |
|---|---|
| NIFTY 50 | `^NSEI` |
| SENSEX | `^BSESN` |
| BANK NIFTY | `^NSEBANK` |
| NASDAQ | `^IXIC` |
| RELIANCE | `RELIANCE.NS` |
| DMART | `DMART.NS` |

No market API key is required.

### Important limitation

This Yahoo Finance endpoint is unofficial/undocumented. It is useful for a prototype and reduces API-key/quota dependency, but Yahoo can change or restrict it without notice. For a commercial product or anything that requires guaranteed availability and licensed redistribution, use a licensed market-data provider.

The backend calls Yahoo rather than the browser, and caches each symbol for 60 seconds. This also avoids browser CORS problems and reduces upstream traffic.

## 3. Environment variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required provider keys are still:

- News: https://newsapi.org
- Weather: https://openweathermap.org/api
- Admin: set `ADMIN_TOKEN` for protected manual-price updates

No Twelve Data key is needed.

## 4. Run locally

```bash
npm install
npm start
# open http://localhost:4000
```

Check:

```text
http://localhost:4000/health
http://localhost:4000/api/markets
```

`/api/markets` returns successful quotes individually and reports a per-symbol `error` if a particular symbol is temporarily unavailable.

## 5. Frontend behavior

The market cards no longer contain hard-coded prices that can look current when the API is unavailable.

If the market feed works, the live quote is displayed. If it fails, the card shows `--` and `Market data unavailable` rather than a stale price.

RELIANCE and DMART trade-card LTP values are also updated from the same market endpoint when available.

## 6. Updating grocery/fuel prices

The existing manual price endpoint remains unchanged:

```bash
curl -X PUT https://yourapp.onrender.com/api/prices/grocery \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: <set ADMIN_TOKEN in your env vars>" \
  -d '{"items": [ ... same shape as data/manual-prices.json ... ]}'
```

## 7. Deployment

This is a standard Node/Express app. It can be deployed to a Node-compatible host such as Render or Railway.

Set environment variables in the hosting provider dashboard rather than committing `.env`.

## 8. Recommended next step

If BRIEF grows beyond an MVP, put a provider abstraction around `/api/markets` so Yahoo can be replaced with a licensed provider without changing the frontend contract. Keep the 60-second cache and consider a scheduled pre-fetch once traffic increases.


## BRIEF v2 — Comparison + Personalization foundation

This version keeps the existing BRIEF experience intact while adding a new comparison layer.

### Comparison APIs
- `GET /api/compare/defaults` — Daily Essentials shown by default.
- `GET /api/compare/search?q=...&userId=...` — Product search + store price comparison.
- `GET /api/compare/recommendations?userId=...` — User recommendations; falls back to popular/default products.
- `POST /api/compare/location` — Stores user-provided latitude/longitude for local recommendations.
- `POST /api/compare/activity` — Records product view/compare/buy-click activity.

### Database
PostgreSQL is used for users, locations, products, stores, prices, search history and user-product activity. Set `DATABASE_URL` in the new deployment. The server seeds the initial grocery catalog from `data/manual-prices.json`.

The browser creates a non-identifying local user ID so search history can be associated with the same browser without requiring login. Location is only submitted after browser geolocation permission.

### Important MVP limitation
The initial grocery prices are still the existing manual/sample feed. The comparison engine is ready for real store feeds later. Do not present these values as live store prices until a real source is connected.

## BRIEF v2 — Comparison + Personalization foundation

This version keeps the existing BRIEF experience intact while adding a new comparison layer.

### Comparison APIs
- `GET /api/compare/defaults` — Daily Essentials shown by default.
- `GET /api/compare/search?q=...&userId=...` — Product search + store price comparison.
- `GET /api/compare/recommendations?userId=...` — User recommendations; falls back to popular/default products.
- `POST /api/compare/location` — Stores user-provided latitude/longitude for local recommendations.
- `POST /api/compare/activity` — Records product view/compare/buy-click activity.

### Database
PostgreSQL is used for users, locations, products, stores, prices, search history and user-product activity. Set `DATABASE_URL` in the new deployment. The server seeds the initial grocery catalog from `data/manual-prices.json`.

The browser creates a non-identifying local user ID so search history can be associated with the same browser without requiring login. Location is only submitted after browser geolocation permission.

### Important MVP limitation
The initial grocery prices are still the existing manual/sample feed. The comparison engine is ready for real store feeds later. Do not present these values as live store prices until a real source is connected.
