import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DB_PATH = process.env.RAILGO_DB || path.join(process.cwd(), "data", "railgo.sqlite3");

// Migration 1: the original schema (IF NOT EXISTS so pre-migration databases upgrade cleanly).
const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS passengers (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL,
  berth_pref TEXT NOT NULL DEFAULT 'NP',
  id_type TEXT,
  id_number TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pnr TEXT UNIQUE,
  train_id TEXT NOT NULL,
  journey_date TEXT NOT NULL,
  run_date TEXT NOT NULL,
  from_code TEXT NOT NULL,
  to_code TEXT NOT NULL,
  class_code TEXT NOT NULL,
  quota TEXT NOT NULL,
  status TEXT NOT NULL,
  accept_wl INTEGER NOT NULL DEFAULT 1,
  scheduled_for INTEGER,
  fare_total INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at INTEGER NOT NULL,
  booked_at INTEGER,
  attempt_ms INTEGER
);
CREATE INDEX IF NOT EXISTS bookings_due ON bookings(status, scheduled_for);
CREATE INDEX IF NOT EXISTS bookings_user ON bookings(user_id, created_at);
CREATE TABLE IF NOT EXISTS booking_passengers (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL,
  berth_pref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  coach TEXT,
  berth_no INTEGER,
  berth_type TEXT,
  wl_no INTEGER,
  fare INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS bp_booking ON booking_passengers(booking_id);
CREATE TABLE IF NOT EXISTS seat_holds (
  train_id TEXT NOT NULL,
  journey_date TEXT NOT NULL,
  class_code TEXT NOT NULL,
  coach TEXT NOT NULL,
  berth_no INTEGER NOT NULL,
  passenger_id INTEGER NOT NULL REFERENCES booking_passengers(id) ON DELETE CASCADE,
  PRIMARY KEY (train_id, journey_date, class_code, coach, berth_no)
);
`;

// Versioned migrations, applied once each and recorded in schema_migrations.
// Never edit a shipped migration; append a new one.
const MIGRATIONS = [
  [SCHEMA_V1],
  [
    // Real IRCTC PNRs a user tracks via /live (read-only lookups).
    `CREATE TABLE tracked_pnrs (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pnr TEXT NOT NULL CHECK(length(pnr) = 10 AND pnr NOT GLOB '*[^0-9]*'),
      label TEXT,
      train_no TEXT, train_name TEXT, journey_date TEXT, from_code TEXT, to_code TEXT, class_code TEXT,
      chart_prepared INTEGER CHECK(chart_prepared IN (0,1)),
      last_summary TEXT, last_payload TEXT, last_provider TEXT, last_error TEXT,
      last_checked_at INTEGER, last_changed_at INTEGER, created_at INTEGER NOT NULL,
      UNIQUE(user_id, pnr))`,
    "CREATE INDEX tracked_pnrs_user ON tracked_pnrs(user_id, created_at)",
    // Every fetched status, append-only: the PNR's full history (WL 12 -> WL 5 -> CNF).
    `CREATE TABLE pnr_snapshots (
      id INTEGER PRIMARY KEY,
      tracked_id INTEGER NOT NULL REFERENCES tracked_pnrs(id) ON DELETE CASCADE,
      fetched_at INTEGER NOT NULL, provider TEXT NOT NULL, summary TEXT NOT NULL,
      changed INTEGER NOT NULL CHECK(changed IN (0,1)), payload TEXT NOT NULL)`,
    "CREATE INDEX pnr_snapshots_tracked ON pnr_snapshots(tracked_id, fetched_at)",
    `CREATE TRIGGER pnr_snapshots_no_update BEFORE UPDATE ON pnr_snapshots
       BEGIN SELECT RAISE(ABORT, 'PNR snapshots are append-only'); END`,
    // Every outbound provider call (never the key), append-only, for quota tracking and debugging.
    `CREATE TABLE api_calls (
      id INTEGER PRIMARY KEY, created_at INTEGER NOT NULL, provider TEXT NOT NULL, kind TEXT NOT NULL,
      path TEXT NOT NULL, status INTEGER, ok INTEGER NOT NULL CHECK(ok IN (0,1)), ms INTEGER, error TEXT)`,
    "CREATE INDEX api_calls_provider ON api_calls(provider, created_at)",
    `CREATE TRIGGER api_calls_no_update BEFORE UPDATE ON api_calls
       BEGIN SELECT RAISE(ABORT, 'API call log is append-only'); END`,
    `CREATE TRIGGER api_calls_no_delete BEFORE DELETE ON api_calls
       BEGIN SELECT RAISE(ABORT, 'API call log is append-only'); END`,
  ],
  [
    // Journey details parsed from pasted IRCTC "Booked Ticket History" (no API call needed).
    "ALTER TABLE tracked_pnrs ADD COLUMN dep_time TEXT",
    "ALTER TABLE tracked_pnrs ADD COLUMN arr_time TEXT",
    "ALTER TABLE tracked_pnrs ADD COLUMN duration TEXT",
    "ALTER TABLE tracked_pnrs ADD COLUMN arrival_date TEXT",
    "ALTER TABLE tracked_pnrs ADD COLUMN from_name TEXT",
    "ALTER TABLE tracked_pnrs ADD COLUMN to_name TEXT",
    "ALTER TABLE tracked_pnrs ADD COLUMN boarding_code TEXT",
    "ALTER TABLE tracked_pnrs ADD COLUMN boarding_name TEXT",
    "ALTER TABLE tracked_pnrs ADD COLUMN booking_status TEXT",
    "ALTER TABLE tracked_pnrs ADD COLUMN source TEXT NOT NULL DEFAULT 'api'",
  ],
  [
    // PNR status APIs never return names, so the user labels passengers: {"1": "Mani", "2": "Amma"}.
    "ALTER TABLE tracked_pnrs ADD COLUMN passenger_names TEXT NOT NULL DEFAULT '{}'",
  ],
];

function migrate(db) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)");
    const version = db.prepare("SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations").get().v;
    if (version > MIGRATIONS.length) throw new Error("Database schema is newer than this app. Update the app.");
    MIGRATIONS.forEach((statements, i) => {
      if (i + 1 <= version) return;
      for (const sql of statements) db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(i + 1, Date.now());
    });
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function openDatabase(file = DB_PATH) {
  mkdirSync(path.dirname(file), { recursive: true });
  // `timeout` = busy timeout, so parallel build workers wait instead of failing.
  const db = new DatabaseSync(file, { timeout: 15000 });
  const mode = db.prepare("PRAGMA journal_mode = WAL").get().journal_mode;
  if (mode !== "wal") throw new Error("SQLite WAL mode is required; keep the database on a local disk.");
  // FULL: a confirmed booking survives a power cut.
  db.exec("PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL;");
  migrate(db);
  return db;
}

export const DATABASE_PATH = DB_PATH;
const open = () => openDatabase();

// Opened lazily on first use and reused across hot reloads and route bundles.
function conn() {
  return (globalThis.__railgoDb ??= open());
}
export const db = new Proxy(
  {},
  {
    get(_, key) {
      const d = conn();
      const v = d[key];
      return typeof v === "function" ? v.bind(d) : v;
    },
  }
);

// Run fn inside an IMMEDIATE transaction (serialises writers, so two
// auto-book jobs can never grab the same berth).
export function tx(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
