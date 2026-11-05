// Rail engine: search, booking windows, fares and seat inventory.
import { CLASSES, STATION_MAP, TRAINS, TRAIN_MAP } from "./data";
import { db } from "./db";
import { addDays, istToMs, todayIST, weekdayIndex } from "./time";

export const ARP_DAYS = 60; // general advance reservation period

// ---------- deterministic pseudo-randomness (FNV-1a) ----------
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
const rand = (str) => hash(str) / 0xffffffff;

// ---------- train geometry ----------
export function getTrain(id) {
  return TRAIN_MAP[id] ?? null;
}

export function segment(train, fromCode, toCode) {
  const from = train.stops.find((s) => s.code === fromCode);
  const to = train.stops.find((s) => s.code === toCode);
  if (!from || !to || from.seq >= to.seq) return null;
  return { from, to, km: to.km - from.km, duration: to.arr - from.dep };
}

// Date the train leaves its origin, given the boarding date at `from`.
export function originDate(journeyDate, fromStop) {
  return addDays(journeyDate, -Math.floor(fromStop.dep / 1440));
}

export function runsOn(train, journeyDate, fromStop) {
  return train.days[weekdayIndex(originDate(journeyDate, fromStop))] === "1";
}

export function departureMs(journeyDate, fromStop) {
  return istToMs(journeyDate, fromStop.dep % 1440);
}

// ---------- quota pools ----------
// The last coach of each class is the Tatkal pool; the rest are General.
// Ladies / Senior Citizen quotas draw from the General pool with eligibility rules.
export function coachesFor(train, classCode, quota) {
  const cls = CLASSES[classCode];
  const n = train.classes[classCode] ?? 0;
  const all = Array.from({ length: n }, (_, i) => `${cls.prefix}${i + 1}`);
  if (n <= 1) return all; // single coach: shared pool
  return quota === "TQ" ? all.slice(-1) : all.slice(0, -1);
}

// ---------- booking windows ----------
export function bookingWindow(train, journeyDate, fromCode, classCode, quota) {
  const from = train.stops.find((s) => s.code === fromCode);
  const start = originDate(journeyDate, from);
  const dep = departureMs(journeyDate, from);
  let opensAt;
  if (quota === "TQ") {
    // Tatkal opens one day before the origin date: 10:00 AC, 11:00 non-AC.
    opensAt = istToMs(addDays(start, -1), CLASSES[classCode].ac ? 600 : 660);
  } else {
    opensAt = istToMs(addDays(start, -ARP_DAYS), 480);
  }
  const closesAt = dep - 30 * 60000;
  return { opensAt, closesAt, departsAt: dep };
}

// ---------- simulated demand ----------
// Share of a pool already sold to "other passengers" at time `now`.
// Tatkal sells out within minutes of opening — which is why auto-booking at
// the exact opening second matters.
function soldShare(trainId, journeyDate, classCode, quota, win, now) {
  const peak = 0.55 + 0.45 * rand(`${trainId}|${journeyDate}|${classCode}|${quota}|peak`);
  if (now < win.opensAt) return 0;
  if (quota === "TQ") {
    const mins = (now - win.opensAt) / 60000;
    return Math.min(1, (mins / 6) ** 0.6) * Math.min(1, peak + 0.2);
  }
  const daysLeft = Math.max(0, (win.departsAt - now) / 864e5);
  return peak * Math.min(1, Math.max(0.1, 1 - daysLeft / ARP_DAYS) ** 0.5);
}

function berthType(classCode, berthNo) {
  const p = CLASSES[classCode].pattern;
  return p[(berthNo - 1) % p.length];
}

// All berths in the pool with their state.
// `runDate` is the date the train leaves its origin station.
export function inventory(train, runDate, classCode, quota, now = Date.now()) {
  const win = bookingWindow(train, runDate, train.stops[0].code, classCode, quota);
  const share = soldShare(train.id, runDate, classCode, quota, win, now);
  const coaches = coachesFor(train, classCode, quota);
  const held = new Set(
    db
      .prepare("SELECT coach, berth_no FROM seat_holds WHERE train_id = ? AND journey_date = ? AND class_code = ?")
      .all(train.id, runDate, classCode)
      .map((r) => `${r.coach}-${r.berth_no}`)
  );
  const berths = [];
  for (const coach of coaches) {
    for (let b = 1; b <= CLASSES[classCode].berths; b++) {
      const key = `${coach}-${b}`;
      const otherSold = rand(`${train.id}|${runDate}|${classCode}|${key}`) < share;
      berths.push({ coach, berthNo: b, type: berthType(classCode, b), free: !otherSold && !held.has(key) });
    }
  }
  return { berths, share };
}

export function availability(train, runDate, classCode, quota, now = Date.now()) {
  const win = bookingWindow(train, runDate, train.stops[0].code, classCode, quota);
  const { berths, share } = inventory(train, runDate, classCode, quota, now);
  const free = berths.filter((b) => b.free).length;
  const realWl = db
    .prepare(
      `SELECT COUNT(*) AS n FROM booking_passengers bp JOIN bookings b ON b.id = bp.booking_id
       WHERE b.train_id = ? AND b.run_date = ? AND b.class_code = ? AND b.quota = ? AND bp.status = 'WL'`
    )
    .get(train.id, runDate, classCode, quota).n;
  const phantomWl = share > 0.97 ? Math.floor(rand(`${train.id}|${runDate}|${classCode}|wl`) * 60) : 0;
  return {
    free,
    total: berths.length,
    wl: free > 0 ? 0 : phantomWl + realWl,
    open: now >= win.opensAt && now < win.closesAt,
    notYetOpen: now < win.opensAt,
    closed: now >= win.closesAt,
    ...win,
  };
}

// ---------- fares ----------
const SUPERFAST = (t) => t.number.startsWith("12") || t.number.startsWith("22");

export function fareFor(train, classCode, quota, km, age) {
  if (age < 5) return 0;
  const cls = CLASSES[classCode];
  let base = Math.max(cls.min, Math.round(cls.perKm * km));
  if (age >= 5 && age < 12 && cls.sleeper) base = Math.round(base * 0.5);
  const reservation = cls.ac ? 60 : 20;
  const sf = SUPERFAST(train) ? (cls.ac ? 45 : 30) : 0;
  const tatkal = quota === "TQ" ? Math.min(cls.ac ? 500 : 200, Math.max(cls.ac ? 125 : 10, Math.round(base * 0.3))) : 0;
  const gst = cls.ac ? Math.round((base + reservation + sf + tatkal) * 0.05) : 0;
  return base + reservation + sf + tatkal + gst;
}

// ---------- search ----------
export function searchTrains(fromCode, toCode, journeyDate, quota = "GN", now = Date.now()) {
  if (!STATION_MAP[fromCode] || !STATION_MAP[toCode] || fromCode === toCode) return [];
  const results = [];
  for (const train of TRAINS) {
    const seg = segment(train, fromCode, toCode);
    if (!seg || !runsOn(train, journeyDate, seg.from)) continue;
    const runDate = originDate(journeyDate, seg.from);
    const classes = Object.keys(train.classes).map((code) => {
      const win = bookingWindow(train, journeyDate, fromCode, code, quota);
      const av = availability(train, runDate, code, quota, now);
      return {
        code,
        fare: fareFor(train, code, quota, seg.km, 30),
        ...av,
        ...win,
        open: now >= win.opensAt && now < win.closesAt,
        notYetOpen: now < win.opensAt,
        closed: now >= win.closesAt,
      };
    });
    results.push({ train, seg, classes });
  }
  return results.sort((a, b) => (a.seg.from.dep % 1440) - (b.seg.from.dep % 1440));
}

export function todayPlus(n) {
  return addDays(todayIST(), n);
}
