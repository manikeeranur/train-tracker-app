# RailGo

A fast train-booking app with **scheduled auto-booking**. You pick a train, class, berth preferences and passengers. If the booking window isn't open yet, RailGo stores the booking and allocates berths the moment the window opens. A 1-second server scheduler handles this.

RailGo runs its **own simulated booking system** (trains, inventory, PNRs). It does not connect to or automate IRCTC.

## Run

```bash
npm install
npm run build && npm start   # http://localhost:3010 (production, fastest)
npm run dev                  # http://localhost:3010 (development)
```

Requires Node 22.13+ (uses built-in `node:sqlite`). Data lives in `data/railgo.sqlite3`. Delete it to reset.

## How it works

| Piece | File |
|---|---|
| Stations, trains, coach layouts, fares | `lib/data.js` |
| Search, booking windows, simulated demand, inventory | `lib/rail.js` |
| Create / allocate / auto-book / cancel / waitlist promotion | `lib/booking.js` |
| 1s auto-book scheduler (starts with the server) | `instrumentation.js` |
| Auth (scrypt + session cookie) | `lib/auth.js` |
| Server actions | `app/actions.js` |

- **Windows:** General opens 60 days before the origin date at 08:00 IST. Tatkal opens 1 day before at 10:00 IST (AC) or 11:00 IST (non-AC). Booking closes 30 min before departure.
- **Simulated demand:** other passengers fill seats deterministically. Tatkal sells out within ~6 minutes of opening, so booking at the exact second matters.
- **Allocation:** runs in a `BEGIN IMMEDIATE` transaction, so two jobs never get the same berth. It honours berth preference, keeps a group in the same coach, and gives lower berths to seniors and women 45+. If seats run out it falls back to the waitlist, or fails if you didn't accept a waitlist.
- **Cancellation:** frees the berths and promotes waitlisted passengers.
- **Demo:** a scheduled booking has a "Simulate window open now" button.

Run a single server process. The scheduler lives in-process.

## Live rail info (`/live`, read-only)

Real PNR status, trains between stations, seat availability, live running status and schedules come from a third-party provider. The default is RapidAPI `irctc1`. RailGo only reads data. It never logs in to IRCTC or books anything.

1. Sign up on rapidapi.com and subscribe to the **IRCTC** API by IRCTCAPI. It has a free plan with a small monthly limit.
2. Run `cp .env.example .env.local` and set `RAIL_API_KEY`.
3. Run `npm run build && npm start`.

The key stays on the server. Responses are cached for 60s to save quota. If the provider changes its paths, override them with the `RAIL_API_*_PATH` variables in `.env.example`.

## My PNRs (`/pnrs`)

Save real IRCTC PNRs. You can type one, or paste an IRCTC SMS, email or Booked Ticket History page and every 10-digit PNR in it is picked up. Each status fetch is stored in `pnr_snapshots`, so you get a history like WL 12 → WL 5 → CNF. When you open the page, stale PNRs (older than 30 min, journey not yet over, max 10 per visit) are refreshed in the background.

## Database

SQLite in WAL mode with `synchronous=FULL`. Versioned migrations are recorded in `schema_migrations`. To change the schema, append a new migration and never edit a shipped one. `pnr_snapshots` and `api_calls` are append-only: SQLite triggers block updates, and `api_calls` also blocks deletes.

```bash
npm run db:check    # integrity, foreign keys, schema version, row counts
npm run db:backup   # online backup to data/backups/ (safe while the app runs)
```
