# MarketXI (MVP)

Creator-led FC trading subscriptions + feed + tools hooks.

## What you get (MVP)
- Email/password auth (JWT)
- Roles: user | trader | admin
- Trader profiles (banner/avatar/bio/price/verified)
- Posts (free/premium) with attached card trade ranges
- Subscriptions (DB-backed; Stripe hook points included)
- Discord connect stub (OAuth + role sync hook points)
- React + Vite + Tailwind UI (feed, trader page, login/register)

## Quick start (Docker)
```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:8000/docs

### Environment
Copy `.env.example` to `.env` and adjust if needed (Docker defaults work).
