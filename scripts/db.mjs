// Usage: node scripts/db.mjs check | backup [dest]
// Works while the app is running (WAL + online backup API).
import { backup, DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const file = process.env.RAILGO_DB || path.join(process.cwd(), "data", "railgo.sqlite3");
const cmd = process.argv[2];

function check(f) {
  const db = new DatabaseSync(f, { readOnly: true, timeout: 10000 });
  const out = {
    file: f,
    integrity: db.prepare("PRAGMA quick_check").get().quick_check,
    foreign_key_errors: db.prepare("PRAGMA foreign_key_check").all().length,
    schema_version: db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get().v,
    rows: Object.fromEntries(
      ["users", "bookings", "tracked_pnrs", "pnr_snapshots", "api_calls"].map((t) => [t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n])
    ),
  };
  db.close();
  return out;
}

if (cmd === "check") {
  console.log(check(file));
} else if (cmd === "backup") {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.resolve(process.argv[3] || path.join(path.dirname(file), "backups", `railgo-${stamp}.sqlite3`));
  if (existsSync(dest) || dest === path.resolve(file)) throw new Error("Backup destination must be a new file");
  mkdirSync(path.dirname(dest), { recursive: true });
  const src = new DatabaseSync(file, { timeout: 10000 });
  await backup(src, dest);
  src.close();
  const c = check(dest);
  if (c.integrity !== "ok") throw new Error("Backup integrity check failed");
  console.log("Backup written:", dest, c.rows);
} else {
  console.log("Usage: node scripts/db.mjs check | backup [dest]");
  process.exit(1);
}
