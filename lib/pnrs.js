import "server-only";
import { col, many, nextId, one } from "./db";
import { STATION_MAP } from "./data";
import { fetchLive } from "./live";
import { istToMs } from "./time";

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
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Fill journey details from a PNR payload. Pasted IRCTC-history details win; only gaps
// (and unparsed dates like "Nov 19, 2026 11:10:00 PM") are filled.
async function applyDetails(trackedId, n) {
  const row = await one("tracked_pnrs", { id: trackedId });
  if (!row) return;
  const keep = (cur, v) => cur ?? v ?? null; // COALESCE(current, new)
  const isoOr = (cur, v) => (cur != null && ISO.test(cur) ? cur : v ?? cur ?? null);
  await (await col("tracked_pnrs")).updateOne(
    { id: trackedId },
    {
      $set: {
        train_no: keep(row.train_no, n.trainNo == null ? null : String(n.trainNo)),
        train_name: keep(row.train_name, n.trainName),
        journey_date: isoOr(row.journey_date, n.depDate),
        arrival_date: isoOr(row.arrival_date, n.arrDate),
        dep_time: keep(row.dep_time, n.depTime),
        arr_time: keep(row.arr_time, n.arrTime),
        duration: keep(row.duration, n.duration),
        from_code: keep(row.from_code, n.from),
        to_code: keep(row.to_code, n.to),
        boarding_code: keep(row.boarding_code, n.boarding),
        from_name: keep(row.from_name, STATION_MAP[n.from]?.name),
        to_name: keep(row.to_name, STATION_MAP[n.to]?.name),
        class_code: n.cls ?? row.class_code ?? null,
        chart_prepared: n.chartPrepared ?? row.chart_prepared ?? null,
      },
    }
  );
}

async function record(trackedId, result, now) {
  const tracked = await col("tracked_pnrs");
  const prev = await one("tracked_pnrs", { id: trackedId }, { projection: { last_summary: 1 } });
  if (result.error) {
    await tracked.updateOne({ id: trackedId }, { $set: { last_error: result.error, last_checked_at: now } });
    return { error: result.error };
  }
  const n = normalisePnr(result.data);
  const summary = summarise(n);
  const changed = prev?.last_summary != null && prev.last_summary !== summary ? 1 : 0;
  await tracked.updateOne(
    { id: trackedId },
    {
      $set: {
        last_summary: summary, last_payload: JSON.stringify(result.data), last_provider: result.provider ?? null,
        last_error: null, last_checked_at: now, ...(changed ? { last_changed_at: now } : {}),
      },
    }
  );
  await applyDetails(trackedId, n);
  // Cached answers aren't new observations; only real fetches go into history (append-only).
  if (!result.cached || prev?.last_summary == null) {
    await (await col("pnr_snapshots")).insertOne({
      id: await nextId("pnr_snapshots"), tracked_id: trackedId, fetched_at: now, provider: result.provider || "cache",
      summary, changed, payload: JSON.stringify(result.data),
    });
  }
  return { summary, changed };
}

const EMPTY_TRACKED = {
  label: null, train_no: null, train_name: null, journey_date: null, from_code: null, to_code: null, class_code: null,
  chart_prepared: null, last_summary: null, last_payload: null, last_provider: null, last_error: null,
  last_checked_at: null, last_changed_at: null, dep_time: null, arr_time: null, duration: null, arrival_date: null,
  from_name: null, to_name: null, boarding_code: null, boarding_name: null, booking_status: null, source: "api",
  passenger_names: "{}",
};

// Insert-or-update a tracked PNR by (user_id, pnr); returns its id.
async function upsertTracked(userId, pnr, fields, now) {
  const tracked = await col("tracked_pnrs");
  const existing = await one("tracked_pnrs", { user_id: userId, pnr }, { projection: { id: 1, label: 1 } });
  if (existing) {
    await tracked.updateOne({ id: existing.id }, { $set: { ...fields, label: fields.label ?? existing.label ?? null } });
    return existing.id;
  }
  const id = await nextId("tracked_pnrs");
  try {
    await tracked.insertOne({ ...EMPTY_TRACKED, ...fields, id, user_id: userId, pnr, created_at: now });
    return id;
  } catch (err) {
    if (err?.code !== 11000) throw err; // raced with another insert of the same PNR: update that one
    return upsertTracked(userId, pnr, fields, now);
  }
}

export async function trackPnr(userId, pnr, label) {
  if (!/^\d{10}$/.test(pnr)) return { error: "Enter a 10-digit PNR." };
  const id = await upsertTracked(userId, pnr, { label: label || null }, Date.now());
  const result = await fetchLive("pnr", { pnr });
  return { id, ...(await record(id, result, Date.now())) };
}

export async function refreshPnr(userId, id) {
  const row = await one("tracked_pnrs", { id, user_id: userId }, { projection: { pnr: 1 } });
  if (!row) return { error: "Not found." };
  const result = await fetchLive("pnr", { pnr: row.pnr }, { fresh: true });
  return record(id, result, Date.now());
}

export async function untrackPnr(userId, id) {
  const { deletedCount } = await (await col("tracked_pnrs")).deleteOne({ id, user_id: userId });
  if (deletedCount) await (await col("pnr_snapshots")).deleteMany({ tracked_id: id });
}

/**
 * A journey is completed once the train has reached: arrival date + time (IST) is in the past.
 * Without an arrival time, the whole arrival day counts as travelling.
 */
export function isCompleted(p, now = Date.now()) {
  const end = p.arrival_date && ISO.test(p.arrival_date) ? p.arrival_date : p.journey_date;
  if (!end || !ISO.test(end)) return false;
  const m = /^(\d{2}):(\d{2})$/.exec(p.arr_time || "");
  const at = m ? istToMs(end, Number(m[1]) * 60 + Number(m[2])) : istToMs(end, 24 * 60);
  return at <= now;
}

/** Delete every completed journey of a user (and their status history). */
export async function deleteCompleted(userId, now = Date.now()) {
  const ids = (await many("tracked_pnrs", { user_id: userId })).filter((p) => isCompleted(p, now)).map((p) => p.id);
  if (!ids.length) return 0;
  await (await col("tracked_pnrs")).deleteMany({ user_id: userId, id: { $in: ids } });
  await (await col("pnr_snapshots")).deleteMany({ tracked_id: { $in: ids } });
  return ids.length;
}

export async function listTracked(userId) {
  const rows = await many("tracked_pnrs", { user_id: userId });
  const stale = rows.filter((r) => r.last_payload != null && (r.journey_date == null || !ISO.test(r.journey_date) || r.dep_time == null));
  if (stale.length) {
    for (const r of stale) await applyDetails(r.id, normalisePnr(JSON.parse(r.last_payload)));
    return listTracked(userId);
  }
  return rows.sort((a, b) => (b.last_changed_at ?? b.created_at) - (a.last_changed_at ?? a.created_at));
}

export async function getTracked(userId, id) {
  const row = await one("tracked_pnrs", { id, user_id: userId });
  if (!row) return null;
  const history = await many("pnr_snapshots", { tracked_id: id }, {
    sort: { fetched_at: -1 }, limit: 200, projection: { id: 1, fetched_at: 1, provider: 1, summary: 1, changed: 1 },
  });
  return { ...row, history, normalised: row.last_payload ? normalisePnr(JSON.parse(row.last_payload)) : null };
}

// Save tickets parsed from pasted IRCTC history (no API call). Status is fetched later.
export async function saveParsed(userId, tickets, label) {
  const now = Date.now();
  for (const t of tickets) {
    await upsertTracked(userId, t.pnr, {
      label: label || null, train_no: t.trainNo, train_name: t.trainName, journey_date: t.journeyDate,
      arrival_date: t.arrivalDate, from_code: t.from, from_name: t.fromName, to_code: t.to, to_name: t.toName,
      dep_time: t.depTime, arr_time: t.arrTime, duration: t.duration, boarding_code: t.boarding,
      boarding_name: t.boardingName, booking_status: t.bookingStatus, source: "irctc-history",
    }, now);
  }
  return tickets.map((t) => t.pnr);
}

export async function apiUsage() {
  const since = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1);
  return (await col("api_calls"))
    .aggregate([
      { $match: { created_at: { $gte: since } } },
      { $group: { _id: "$provider", calls: { $sum: 1 }, ok: { $sum: "$ok" } } },
      { $project: { _id: 0, provider: "$_id", calls: 1, ok: 1 } },
    ])
    .toArray();
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

export async function staleIds(userId, now = Date.now()) {
  const rows = await many("tracked_pnrs", { user_id: userId }, { projection: { id: 1, journey_date: 1, last_checked_at: 1 } });
  // Never-checked first, then by journey date, then oldest check.
  rows.sort(
    (a, b) =>
      (a.last_checked_at != null) - (b.last_checked_at != null) ||
      String(a.journey_date ?? "").localeCompare(String(b.journey_date ?? "")) ||
      (a.last_checked_at ?? 0) - (b.last_checked_at ?? 0)
  );
  return rows
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
  const ids = await staleIds(userId);
  let changed = 0;
  for (const id of ids) {
    const r = await refreshPnr(userId, id);
    if (r.changed) changed++;
  }
  return { synced: ids.length, changed };
}

export async function setPassengerName(userId, id, n, name) {
  const row = await one("tracked_pnrs", { id, user_id: userId }, { projection: { passenger_names: 1 } });
  if (!row) return;
  const clean = String(name || "").trim().slice(0, 40);
  const names = JSON.parse(row.passenger_names || "{}");
  if (clean) names[n] = clean;
  else delete names[n];
  await (await col("tracked_pnrs")).updateOne({ id, user_id: userId }, { $set: { passenger_names: JSON.stringify(names) } });
}
