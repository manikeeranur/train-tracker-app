// MongoDB (Atlas) data layer. Works on Vercel: the connection is cached on
// globalThis so warm serverless invocations and dev hot reloads reuse it.
//
// Every document keeps the integer `id` the app used with SQLite (URLs like
// /bookings/7 and hidden form ids stay unchanged). Ids come from the
// `counters` collection. Reads go through `one`/`many`, which drop Mongo's
// `_id` so rows stay plain, serialisable objects.
import { MongoClient } from "mongodb";

const URI = process.env.MONGO_URI;

// Unique keys mirror the old SQLite constraints.
const INDEXES = {
  users: [[{ id: 1 }, { unique: true }], [{ email: 1 }, { unique: true }]],
  sessions: [[{ token: 1 }, { unique: true }], [{ expires: 1 }, { expireAfterSeconds: 0 }]],
  passengers: [[{ id: 1 }, { unique: true }], [{ user_id: 1, name: 1 }]],
  bookings: [
    [{ id: 1 }, { unique: true }],
    [{ pnr: 1 }, { unique: true, partialFilterExpression: { pnr: { $type: "string" } } }],
    [{ status: 1, scheduled_for: 1 }],
    [{ user_id: 1, created_at: -1 }],
    [{ train_id: 1, run_date: 1, class_code: 1, quota: 1 }],
  ],
  booking_passengers: [[{ id: 1 }, { unique: true }], [{ booking_id: 1, seq: 1 }], [{ booking_id: 1, status: 1 }]],
  // A berth can be held by one passenger only: two auto-book jobs can never grab the same seat.
  seat_holds: [
    [{ train_id: 1, journey_date: 1, class_code: 1, coach: 1, berth_no: 1 }, { unique: true }],
    [{ passenger_id: 1 }],
  ],
  tracked_pnrs: [[{ id: 1 }, { unique: true }], [{ user_id: 1, pnr: 1 }, { unique: true }]],
  pnr_snapshots: [[{ id: 1 }, { unique: true }], [{ tracked_id: 1, fetched_at: -1 }]],
  api_calls: [[{ provider: 1, created_at: 1 }]],
};

async function connect() {
  if (!URI) throw new Error("MONGO_URI is not set. Add it to .env.local (or Vercel env) and restart.");
  const client = new MongoClient(URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const database = client.db(); // database name comes from the URI path (/irctc-app)
  await Promise.all(
    Object.entries(INDEXES).flatMap(([name, list]) => list.map(([keys, opts]) => database.collection(name).createIndex(keys, opts)))
  );
  return { client, database };
}

function conn() {
  const g = globalThis;
  g.__railgoMongo ??= connect().catch((err) => {
    g.__railgoMongo = undefined; // let the next request retry
    throw err;
  });
  return g.__railgoMongo;
}

export async function col(name) {
  return (await conn()).database.collection(name);
}

const NO_ID = { _id: 0 };

export async function one(name, filter, opts = {}) {
  return (await col(name)).findOne(filter, { ...opts, projection: { ...NO_ID, ...opts.projection } });
}

export async function many(name, filter, opts = {}) {
  return (await col(name)).find(filter, { ...opts, projection: { ...NO_ID, ...opts.projection } }).toArray();
}

/** Next integer id for a collection (atomic). */
export async function nextId(name, session) {
  const r = await (await col("counters")).findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session }
  );
  return r.seq;
}

/** Run fn(session) in a multi-document transaction (Atlas is a replica set). */
export async function tx(fn) {
  const { client } = await conn();
  const session = client.startSession();
  try {
    let out;
    await session.withTransaction(async () => {
      out = await fn(session);
    });
    return out;
  } finally {
    await session.endSession();
  }
}

export async function closeDatabase() {
  const c = globalThis.__railgoMongo;
  globalThis.__railgoMongo = undefined;
  if (c) await (await c).client.close();
}
