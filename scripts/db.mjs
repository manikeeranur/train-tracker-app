// Usage (reads MONGO_URI from .env.local):
//   node --env-file=.env.local scripts/db.mjs check
//   node --env-file=.env.local scripts/db.mjs import-sqlite [data/railgo.sqlite3]
//
// import-sqlite copies the old SQLite database into MongoDB once. It keeps every
// integer id (so links like /bookings/7 still work) and sets the id counters past
// the highest id. It refuses to run if MongoDB already has users, so it can't
// duplicate data.
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { MongoClient } from "mongodb";

const TABLES = ["users", "sessions", "passengers", "bookings", "booking_passengers", "seat_holds", "tracked_pnrs", "pnr_snapshots", "api_calls"];
const COUNTED = ["users", "passengers", "bookings", "booking_passengers", "tracked_pnrs", "pnr_snapshots"];

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("MONGO_URI is not set. Run with: node --env-file=.env.local scripts/db.mjs ...");
  process.exit(1);
}
const client = new MongoClient(uri);
await client.connect();
const mdb = client.db();

async function counts() {
  return Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await mdb.collection(t).countDocuments()])));
}

async function importSqlite(file) {
  if (await mdb.collection("users").countDocuments()) throw new Error("MongoDB already has users; refusing to import twice.");
  const sql = new DatabaseSync(file, { readOnly: true });
  for (const t of TABLES) {
    let rows = sql.prepare(`SELECT * FROM ${t}`).all().map((r) => ({ ...r }));
    if (t === "sessions") rows = rows.map((r) => ({ ...r, expires: new Date(r.expires_at) })); // TTL index field
    if (t === "api_calls") rows = rows.map(({ id, ...r }) => r); // log rows have no app-level id
    if (rows.length) await mdb.collection(t).insertMany(rows, { ordered: true });
    console.log(`${t}: ${rows.length}`);
  }
  for (const t of COUNTED) {
    const max = sql.prepare(`SELECT COALESCE(MAX(id), 0) AS m FROM ${t}`).get().m;
    await mdb.collection("counters").updateOne({ _id: t }, { $max: { seq: max } }, { upsert: true });
  }
  sql.close();
}

try {
  const cmd = process.argv[2];
  if (cmd === "check") {
    console.log({ database: mdb.databaseName, rows: await counts() });
  } else if (cmd === "import-sqlite") {
    const file = path.resolve(process.argv[3] || path.join("data", "railgo.sqlite3"));
    await importSqlite(file);
    console.log("Imported into", mdb.databaseName, await counts());
  } else {
    console.log("Usage: node --env-file=.env.local scripts/db.mjs check | import-sqlite [file]");
    process.exitCode = 1;
  }
} finally {
  await client.close();
}
