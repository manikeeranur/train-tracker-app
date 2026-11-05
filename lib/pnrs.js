import "server-only";
import { db, tx } from "./db";
import { STATION_MAP } from "./data";
import { fetchLive } from "./live";

// ---------- normalise any provider's PNR payload ----------
// Providers name fields differently (TrainNo / trainNumber / train_no ...), so we
// search the payload for the first key matching each pattern.
function find(obj, re, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 4) return undefined;
  for (const [k, v] of Object.entries(obj)) if (re.test(k) && v != null && typeof v !== "object") return v;
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const hit = find(v, re, depth + 1);
      if (hit !== undefined) return hit;
    }
  }
  return undefined;
}

function findPassengers(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 4) return [];
  for (const v of Object.values(obj)) {
    if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === "object") && v.some((x) => Object.keys(x).some((k) => /current.?status|currentstatus/i.test(k)))) {
      return v;
    }
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") {
      const hit = findPassengers(v, depth + 1);
      if (hit.length) return hit;
    }
  }
  return [];
}

const pick = (o, re) => {
  const k = Object.keys(o).find((x) => re.test(x));
  return k ? o[k] : undefined;
};

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");

// "Nov 19, 2026 11:10:00 PM" | "19-11-2026" | "2026-11-19 23:10" → { date: "2026-11-19", time: "23:10" | null }
export function parseDateTime(v) {
  if (v == null) return { date: null, time: null };
  const s = String(v).trim();
  let date = null;
  let m;
  if ((m = s.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/)) && MON[m[1].toLowerCase()]) date = `${m[3]}-${pad(MON[m[1].toLowerCase()])}-${pad(m[2])}`;
  else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) date = `${m[1]}-${m[2]}-${m[3]}`;
  else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) date = `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  else if ((m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ,]+(\d{4})/)) && MON[m[2].toLowerCase()]) date = `${m[3]}-${pad(MON[m[2].toLowerCase()])}-${pad(m[1])}`;
  let time = null;
  if ((m = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?/)) && (date ? s.indexOf(m[0]) > 4 : true)) {
    let h = Number(m[1]);
    if (m[3]) h = (h % 12) + (/p/i.test(m[3]) ? 12 : 0);
    time = `${pad(h)}:${m[2]}`;
  }
  return { date, time };
}

function durationBetween(d1, t1, d2, t2) {
  if (!d1 || !t1 || !d2 || !t2) return null;
  const mins = (Date.parse(`${d2}T${t2}:00Z`) - Date.parse(`${d1}T${t1}:00Z`)) / 60000;
  if (!(mins > 0 && mins < 7 * 1440)) return null;
  return `${pad(Math.floor(mins / 60))}h ${pad(mins % 60)}m`;
}

export function normalisePnr(data) {
  const passengers = findPassengers(data).map((p, i) => ({
    n: Number(pick(p, /^(number|serial|passenger.?(no|serial|number))$/i)) || i + 1,
    // Prefer "...StatusDetails" ("RAC/15", "CNF/S4/33/LB") over the bare status ("RAC").
    booking: String(pick(p, /booking.?status.?details/i) ?? pick(p, /booking.?status(?!.*index)/i) ?? pick(p, /^booking/i) ?? "").trim(),
    current: String(pick(p, /current.?status.?details/i) ?? pick(p, /current.?status(?!.*index)/i) ?? "").trim(),
  }));
  const fare = find(data, /^(ticket.?fare|booking.?fare|total.?fare|fare)$/i);
  const chart = find(data, /chart/i);
  const dep = parseDateTime(find(data, /^(doj|date.?of.?journey|journey.?date|source.?doj|boarding.?date)$/i));
  const arr = parseDateTime(find(data, /^(arrival.?date|date.?of.?arrival|destination.?arrival|arrival.?time)$/i));
  return {
    depDate: dep.date,
    depTime: dep.time,
    arrDate: arr.date,
    arrTime: arr.time,
    duration: durationBetween(dep.date, dep.time, arr.date, arr.time),
    boarding: find(data, /^(boarding.?point|board.?point|boarding.?station)$/i) ?? null,
    trainNo: find(data, /^train.?(no|number)$/i) ?? null,
    trainName: find(data, /^train.?name$/i) ?? null,
    journeyDate: find(data, /^(doj|date.?of.?journey|journey.?date|source.?doj|boarding.?date)$/i) ?? null,
    from: find(data, /^(from|from.?station|boarding.?point|source.?station|board.?point|from.?stn.?code)$/i) ?? null,
    to: find(data, /^(to|to.?station|destination.?station|reservation.?upto|to.?stn.?code|dest)$/i) ?? null,
    cls: find(data, /^(class|journey.?class|travel.?class|class.?code)$/i) ?? null,
    fare: fare == null || Number.isNaN(Number(fare)) ? null : Number(fare),
    quota: find(data, /^quota$/i) ?? null,
    chartText: chart == null ? null : String(chart),
    chartPrepared: chart == null ? null : /true|yes|prepared|1/i.test(String(chart)) && !/not/i.test(String(chart)) ? 1 : 0,
    passengers,
  };
}

export function summarise(n) {
  if (!n.passengers.length) return "Status unavailable";
  return n.passengers.map((p) => `P${p.n}: ${p.current || p.booking || "?"}`).join(" · ");
}

// ---------- tracking ----------
// Fill journey details from a PNR payload. Pasted IRCTC-history details win; only gaps
// (and unparsed dates like "Nov 19, 2026 11:10:00 PM") are filled.
function applyDetails(trackedId, n) {
  const isoOr = (col) => `CASE WHEN ${col} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' THEN ${col} ELSE COALESCE(?, ${col}) END`;
  db.prepare(
    `UPDATE tracked_pnrs SET train_no = COALESCE(train_no, ?), train_name = COALESCE(train_name, ?),
       journey_date = ${isoOr("journey_date")}, arrival_date = ${isoOr("arrival_date")},
       dep_time = COALESCE(dep_time, ?), arr_time = COALESCE(arr_time, ?), duration = COALESCE(duration, ?),
       from_code = COALESCE(from_code, ?), to_code = COALESCE(to_code, ?), boarding_code = COALESCE(boarding_code, ?),
       from_name = COALESCE(from_name, ?), to_name = COALESCE(to_name, ?),
       class_code = COALESCE(?, class_code), chart_prepared = COALESCE(?, chart_prepared)
     WHERE id = ?`
  ).run(
    n.trainNo == null ? null : String(n.trainNo), n.trainName, n.depDate, n.arrDate, n.depTime, n.arrTime, n.duration,
    n.from, n.to, n.boarding, STATION_MAP[n.from]?.name ?? null, STATION_MAP[n.to]?.name ?? null,
    n.cls, n.chartPrepared, trackedId
  );
}

function record(trackedId, result, now) {
  const prev = db.prepare("SELECT last_summary FROM tracked_pnrs WHERE id = ?").get(trackedId);
  if (result.error) {
    db.prepare("UPDATE tracked_pnrs SET last_error = ?, last_checked_at = ? WHERE id = ?").run(result.error, now, trackedId);
    return { error: result.error };
  }
  const n = normalisePnr(result.data);
  const summary = summarise(n);
  const changed = prev?.last_summary != null && prev.last_summary !== summary ? 1 : 0;
  db.prepare(
    `UPDATE tracked_pnrs SET last_summary = ?, last_payload = ?, last_provider = ?, last_error = NULL, last_checked_at = ?,
       last_changed_at = CASE WHEN ? THEN ? ELSE last_changed_at END
     WHERE id = ?`
  ).run(summary, JSON.stringify(result.data), result.provider, now, changed, now, trackedId);
  applyDetails(trackedId, n);
  // Cached answers aren't new observations; only real fetches go into history.
  if (!result.cached || prev?.last_summary == null) {
    db.prepare("INSERT INTO pnr_snapshots (tracked_id, fetched_at, provider, summary, changed, payload) VALUES (?, ?, ?, ?, ?, ?)")
      .run(trackedId, now, result.provider || "cache", summary, changed, JSON.stringify(result.data));
  }
  return { summary, changed };
}

export async function trackPnr(userId, pnr, label) {
  if (!/^\d{10}$/.test(pnr)) return { error: "Enter a 10-digit PNR." };
  const now = Date.now();
  const id = tx(() => {
    db.prepare("INSERT INTO tracked_pnrs (user_id, pnr, label, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, pnr) DO UPDATE SET label = COALESCE(excluded.label, label)")
      .run(userId, pnr, label || null, now);
    return db.prepare("SELECT id FROM tracked_pnrs WHERE user_id = ? AND pnr = ?").get(userId, pnr).id;
  });
  const result = await fetchLive("pnr", { pnr });
  return { id, ...tx(() => record(id, result, Date.now())) };
}

export async function refreshPnr(userId, id) {
  const row = db.prepare("SELECT pnr FROM tracked_pnrs WHERE id = ? AND user_id = ?").get(id, userId);
  if (!row) return { error: "Not found." };
  const result = await fetchLive("pnr", { pnr: row.pnr }, { fresh: true });
  return tx(() => record(id, result, Date.now()));
}

export function untrackPnr(userId, id) {
  db.prepare("DELETE FROM tracked_pnrs WHERE id = ? AND user_id = ?").run(id, userId);
}

export function listTracked(userId) {
  const stale = db
    .prepare(
      `SELECT id, last_payload FROM tracked_pnrs WHERE user_id = ? AND last_payload IS NOT NULL
         AND (journey_date IS NULL OR journey_date NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR dep_time IS NULL)`
    )
    .all(userId);
  if (stale.length) tx(() => stale.forEach((r) => applyDetails(r.id, normalisePnr(JSON.parse(r.last_payload)))));
  return db
    .prepare("SELECT * FROM tracked_pnrs WHERE user_id = ? ORDER BY COALESCE(last_changed_at, created_at) DESC")
    .all(userId)
    .map((r) => ({ ...r }));
}

export function getTracked(userId, id) {
  const row = db.prepare("SELECT * FROM tracked_pnrs WHERE id = ? AND user_id = ?").get(id, userId);
  if (!row) return null;
  const history = db
    .prepare("SELECT id, fetched_at, provider, summary, changed FROM pnr_snapshots WHERE tracked_id = ? ORDER BY fetched_at DESC LIMIT 200")
    .all(id)
    .map((r) => ({ ...r }));
  return { ...row, history, normalised: row.last_payload ? normalisePnr(JSON.parse(row.last_payload)) : null };
}

// Save tickets parsed from pasted IRCTC history (no API call). Status is fetched later.
export function saveParsed(userId, tickets, label) {
  const now = Date.now();
  return tx(() =>
    tickets.map((t) => {
      db.prepare(
        `INSERT INTO tracked_pnrs (user_id, pnr, label, train_no, train_name, journey_date, arrival_date, from_code, from_name,
           to_code, to_name, dep_time, arr_time, duration, boarding_code, boarding_name, booking_status, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'irctc-history', ?)
         ON CONFLICT(user_id, pnr) DO UPDATE SET label = COALESCE(excluded.label, label),
           train_no = excluded.train_no, train_name = excluded.train_name, journey_date = excluded.journey_date,
           arrival_date = excluded.arrival_date, from_code = excluded.from_code, from_name = excluded.from_name,
           to_code = excluded.to_code, to_name = excluded.to_name, dep_time = excluded.dep_time, arr_time = excluded.arr_time,
           duration = excluded.duration, boarding_code = excluded.boarding_code, boarding_name = excluded.boarding_name,
           booking_status = excluded.booking_status, source = 'irctc-history'`
      ).run(
        userId, t.pnr, label || null, t.trainNo, t.trainName, t.journeyDate, t.arrivalDate, t.from, t.fromName,
        t.to, t.toName, t.depTime, t.arrTime, t.duration, t.boarding, t.boardingName, t.bookingStatus, now
      );
      return t.pnr;
    })
  );
}

export function apiUsage() {
  const since = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1);
  return db
    .prepare("SELECT provider, COUNT(*) AS calls, SUM(ok) AS ok FROM api_calls WHERE created_at >= ? GROUP BY provider")
    .all(since)
    .map((r) => ({ ...r }));
}

// ---------- auto-sync on visit ----------
const NEAR_STALE_MS = 30 * 60e3; // journey within 3 days: status moves fast
const FAR_STALE_MS = 24 * 3600e3; // further out: once a day is plenty
const SYNC_LIMIT = 15;

// "07-11-2026", "2026-11-07", "07 Nov 2026" → epoch ms (or null).
function parseDate(s) {
  if (!s) return null;
  const str = String(s).trim();
  let m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const t = Date.parse(str);
  return Number.isNaN(t) ? null : t;
}

export function staleIds(userId, now = Date.now()) {
  return db
    .prepare("SELECT id, journey_date, last_checked_at FROM tracked_pnrs WHERE user_id = ? ORDER BY last_checked_at IS NOT NULL, journey_date, last_checked_at")
    .all(userId)
    .filter((r) => {
      const doj = parseDate(r.journey_date);
      const travelled = doj != null && doj < now - 2 * 864e5; // journey over: status is final
      const near = doj == null || doj - now < 3 * 864e5;
      return !travelled && (r.last_checked_at == null || now - r.last_checked_at > (near ? NEAR_STALE_MS : FAR_STALE_MS));
    })
    .slice(0, SYNC_LIMIT)
    .map((r) => r.id);
}

export async function syncStale(userId) {
  const ids = staleIds(userId);
  let changed = 0;
  for (const id of ids) {
    const r = await refreshPnr(userId, id);
    if (r.changed) changed++;
  }
  return { synced: ids.length, changed };
}

export function setPassengerName(userId, id, n, name) {
  tx(() => {
    const row = db.prepare("SELECT passenger_names FROM tracked_pnrs WHERE id = ? AND user_id = ?").get(id, userId);
    if (!row) return;
    const names = JSON.parse(row.passenger_names || "{}");
    const clean = String(name || "").trim().slice(0, 40);
    if (clean) names[n] = clean;
    else delete names[n];
    db.prepare("UPDATE tracked_pnrs SET passenger_names = ? WHERE id = ?").run(JSON.stringify(names), id);
  });
}
