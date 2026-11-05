// Booking engine: create, auto-book scheduled bookings, cancel, promote waitlist.
import { randomInt } from "node:crypto";
import { CLASSES } from "./data";
import { db, tx } from "./db";
import { availability, bookingWindow, fareFor, getTrain, inventory, originDate, runsOn, segment } from "./rail";

export const MAX_PASSENGERS = { GN: 6, TQ: 4, LD: 6, SS: 2 };

export class BookingError extends Error {}

function validatePassengers(passengers, quota) {
  if (!passengers.length) throw new BookingError("Add at least one passenger.");
  if (passengers.length > MAX_PASSENGERS[quota]) {
    throw new BookingError(`Max ${MAX_PASSENGERS[quota]} passengers allowed in this quota.`);
  }
  for (const p of passengers) {
    if (!p.name?.trim()) throw new BookingError("Every passenger needs a name.");
    if (!Number.isInteger(p.age) || p.age < 1 || p.age > 120) throw new BookingError(`Invalid age for ${p.name}.`);
    if (!["M", "F", "T"].includes(p.gender)) throw new BookingError(`Invalid gender for ${p.name}.`);
  }
  if (quota === "LD" && passengers.some((p) => p.gender !== "F" && p.age >= 12)) {
    throw new BookingError("Ladies quota: only female passengers (children under 12 allowed).");
  }
  if (quota === "SS" && passengers.some((p) => (p.gender === "F" ? p.age < 58 : p.age < 60))) {
    throw new BookingError("Senior Citizen quota: men 60+ and women 58+ only.");
  }
}

function newPnr() {
  for (;;) {
    const pnr = String(randomInt(4, 10)) + String(randomInt(0, 1e9)).padStart(9, "0");
    if (!db.prepare("SELECT 1 FROM bookings WHERE pnr = ?").get(pnr)) return pnr;
  }
}

/**
 * Create a booking. If the booking window is already open it's allocated
 * immediately; otherwise it's stored as SCHEDULED and the scheduler books it
 * the moment the window opens.
 */
export function createBooking({ userId, trainId, journeyDate, from, to, classCode, quota, passengers, acceptWl }) {
  const train = getTrain(trainId);
  if (!train) throw new BookingError("Train not found.");
  if (!train.classes[classCode]) throw new BookingError("Class not available on this train.");
  const seg = segment(train, from, to);
  if (!seg) throw new BookingError("Invalid boarding / destination for this train.");
  if (!runsOn(train, journeyDate, seg.from)) throw new BookingError("Train doesn't run on this date.");
  validatePassengers(passengers, quota);

  const now = Date.now();
  const win = bookingWindow(train, journeyDate, from, classCode, quota);
  if (now >= win.closesAt) throw new BookingError("Booking is closed for this train.");
  const scheduled = now < win.opensAt;

  const id = tx(() => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO bookings (user_id, train_id, journey_date, run_date, from_code, to_code, class_code, quota,
           status, accept_wl, scheduled_for, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId, train.id, journeyDate, originDate(journeyDate, seg.from), from, to, classCode, quota,
        scheduled ? "SCHEDULED" : "PROCESSING", acceptWl ? 1 : 0, scheduled ? win.opensAt : now, now
      );
    const ins = db.prepare(
      `INSERT INTO booking_passengers (booking_id, seq, name, age, gender, berth_pref, fare) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    let total = 0;
    passengers.forEach((p, i) => {
      const fare = fareFor(train, classCode, quota, seg.km, p.age);
      total += fare;
      ins.run(lastInsertRowid, i + 1, p.name.trim(), p.age, p.gender, p.berthPref || "NP", fare);
    });
    db.prepare("UPDATE bookings SET fare_total = ? WHERE id = ?").run(total, lastInsertRowid);
    return Number(lastInsertRowid);
  });

  if (!scheduled) allocate(id, now);
  return id;
}

// Pick a berth for one passenger from the free list (mutates `free`).
function pickBerth(free, p, preferCoach) {
  const wants = [];
  if (p.berth_pref && p.berth_pref !== "NP") wants.push(p.berth_pref);
  if (p.age >= 60 || (p.gender === "F" && p.age >= 45)) wants.push("LB", "SL");
  const score = (b) => {
    let s = 0;
    const idx = wants.indexOf(b.type);
    if (idx !== -1) s += 100 - idx * 10;
    if (preferCoach && b.coach === preferCoach) s += 20;
    return s;
  };
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < free.length; i++) {
    const s = score(free[i]);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  }
  return best === -1 ? null : free.splice(best, 1)[0];
}

/** Allocate berths for a SCHEDULED / PROCESSING booking. Runs in one write transaction. */
export function allocate(bookingId, now = Date.now()) {
  return tx(() => {
    const b = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId);
    if (!b || !["SCHEDULED", "PROCESSING"].includes(b.status)) return null;
    const train = getTrain(b.train_id);
    const pax = db.prepare("SELECT * FROM booking_passengers WHERE booking_id = ? ORDER BY seq").all(bookingId);
    const win = bookingWindow(train, b.journey_date, b.from_code, b.class_code, b.quota);
    const latency = b.scheduled_for ? Math.max(0, now - b.scheduled_for) : 0;

    if (now >= win.closesAt) {
      db.prepare("UPDATE bookings SET status = 'FAILED', note = ?, attempt_ms = ? WHERE id = ?")
        .run("Booking window closed before the booking could run.", latency, bookingId);
      return "FAILED";
    }

    const free = inventory(train, b.run_date, b.class_code, b.quota, now).berths.filter((x) => x.free);
    const needBerth = pax.filter((p) => p.age >= 5);
    if (!b.accept_wl && free.length < needBerth.length) {
      db.prepare("UPDATE bookings SET status = 'FAILED', note = ?, attempt_ms = ? WHERE id = ?").run(
        `Only ${free.length} berth(s) left for ${needBerth.length} passenger(s); waitlist not accepted.`,
        latency,
        bookingId
      );
      return "FAILED";
    }

    let wlBase = availability(train, b.run_date, b.class_code, b.quota, now).wl;
    const setPax = db.prepare(
      "UPDATE booking_passengers SET status = ?, coach = ?, berth_no = ?, berth_type = ?, wl_no = ? WHERE id = ?"
    );
    const hold = db.prepare(
      "INSERT INTO seat_holds (train_id, journey_date, class_code, coach, berth_no, passenger_id) VALUES (?, ?, ?, ?, ?, ?)"
    );
    let firstCoach = null;
    let anyWl = false;
    for (const p of pax) {
      if (p.age < 5) {
        setPax.run("CNF", null, null, null, null, p.id); // child below 5: no berth, travels free
        continue;
      }
      const berth = pickBerth(free, p, firstCoach);
      if (berth) {
        firstCoach ??= berth.coach;
        setPax.run("CNF", berth.coach, berth.berthNo, berth.type, null, p.id);
        hold.run(b.train_id, b.run_date, b.class_code, berth.coach, berth.berthNo, p.id);
      } else {
        anyWl = true;
        setPax.run("WL", null, null, null, ++wlBase, p.id);
      }
    }
    const status = anyWl ? "WAITLIST" : "CONFIRMED";
    db.prepare("UPDATE bookings SET status = ?, pnr = ?, booked_at = ?, attempt_ms = ?, note = NULL WHERE id = ?")
      .run(status, newPnr(), now, latency, bookingId);
    return status;
  });
}

/** Called every second by the scheduler: book everything whose window has opened. */
export function processDueBookings(now = Date.now()) {
  const due = db
    .prepare("SELECT id FROM bookings WHERE status = 'SCHEDULED' AND scheduled_for <= ? ORDER BY scheduled_for, id LIMIT 50")
    .all(now);
  for (const { id } of due) {
    try {
      allocate(id, Date.now());
    } catch (err) {
      console.error(`[railgo] auto-book ${id} failed`, err);
      db.prepare("UPDATE bookings SET status = 'FAILED', note = ? WHERE id = ? AND status = 'SCHEDULED'")
        .run(`Internal error: ${err.message}`, id);
    }
  }
  return due.length;
}

/** Demo helper: run a scheduled booking right now, as if the window just opened. */
export function runNow(userId, bookingId) {
  const b = db.prepare("SELECT * FROM bookings WHERE id = ? AND user_id = ?").get(bookingId, userId);
  if (!b || b.status !== "SCHEDULED") throw new BookingError("Only scheduled bookings can be run.");
  const now = Date.now();
  db.prepare("UPDATE bookings SET scheduled_for = ? WHERE id = ?").run(now, bookingId);
  return allocate(bookingId, now);
}

function refundFor(b, pax) {
  const cls = CLASSES[b.class_code];
  if (b.status === "SCHEDULED") return b.fare_total;
  let refund = 0;
  for (const p of pax) {
    if (p.status === "WL") refund += Math.max(0, p.fare - 60);
    else if (b.quota === "TQ") refund += 0; // confirmed Tatkal: no refund
    else refund += Math.max(0, p.fare - (cls.ac ? 240 : 120));
  }
  return refund;
}

export function cancelBooking(userId, bookingId) {
  const result = tx(() => {
    const b = db.prepare("SELECT * FROM bookings WHERE id = ? AND user_id = ?").get(bookingId, userId);
    if (!b) throw new BookingError("Booking not found.");
    if (!["SCHEDULED", "CONFIRMED", "WAITLIST"].includes(b.status)) throw new BookingError("This booking can't be cancelled.");
    const pax = db.prepare("SELECT * FROM booking_passengers WHERE booking_id = ?").all(bookingId);
    const refund = refundFor(b, pax);
    db.prepare("DELETE FROM seat_holds WHERE passenger_id IN (SELECT id FROM booking_passengers WHERE booking_id = ?)").run(bookingId);
    db.prepare("UPDATE booking_passengers SET status = 'CAN' WHERE booking_id = ?").run(bookingId);
    db.prepare("UPDATE bookings SET status = 'CANCELLED', note = ? WHERE id = ?").run(`Refund ₹${refund}`, bookingId);
    return { b, hadSeats: pax.some((p) => p.status === "CNF") };
  });
  if (result.hadSeats) promoteWaitlist(result.b.train_id, result.b.run_date, result.b.class_code, result.b.quota);
  return result;
}

/** After a cancellation, move waitlisted passengers (oldest first) into free berths. */
export function promoteWaitlist(trainId, runDate, classCode, quota) {
  tx(() => {
    const train = getTrain(trainId);
    const free = inventory(train, runDate, classCode, quota).berths.filter((x) => x.free);
    if (!free.length) return;
    const wl = db
      .prepare(
        `SELECT bp.* FROM booking_passengers bp JOIN bookings b ON b.id = bp.booking_id
         WHERE b.train_id = ? AND b.run_date = ? AND b.class_code = ? AND b.quota = ? AND bp.status = 'WL'
         ORDER BY b.booked_at, bp.seq`
      )
      .all(trainId, runDate, classCode, quota);
    const touched = new Set();
    for (const p of wl) {
      const berth = pickBerth(free, p, null);
      if (!berth) break;
      db.prepare("UPDATE booking_passengers SET status = 'CNF', coach = ?, berth_no = ?, berth_type = ?, wl_no = NULL WHERE id = ?")
        .run(berth.coach, berth.berthNo, berth.type, p.id);
      db.prepare("INSERT INTO seat_holds (train_id, journey_date, class_code, coach, berth_no, passenger_id) VALUES (?, ?, ?, ?, ?, ?)")
        .run(trainId, runDate, classCode, berth.coach, berth.berthNo, p.id);
      touched.add(p.booking_id);
    }
    for (const id of touched) {
      const left = db.prepare("SELECT COUNT(*) AS n FROM booking_passengers WHERE booking_id = ? AND status = 'WL'").get(id).n;
      if (!left) db.prepare("UPDATE bookings SET status = 'CONFIRMED' WHERE id = ?").run(id);
    }
  });
}

export function getBooking(userId, id) {
  const b = db.prepare("SELECT * FROM bookings WHERE id = ? AND user_id = ?").get(id, userId);
  if (!b) return null;
  const pax = db.prepare("SELECT * FROM booking_passengers WHERE booking_id = ? ORDER BY seq").all(id);
  return { ...b, passengers: pax.map((p) => ({ ...p })) };
}

export function listBookings(userId) {
  return db
    .prepare("SELECT * FROM bookings WHERE user_id = ? ORDER BY CASE status WHEN 'SCHEDULED' THEN 0 ELSE 1 END, created_at DESC")
    .all(userId)
    .map((b) => ({ ...b }));
}

export function findByPnr(pnr) {
  const b = db.prepare("SELECT * FROM bookings WHERE pnr = ?").get(pnr);
  if (!b) return null;
  const pax = db.prepare("SELECT * FROM booking_passengers WHERE booking_id = ? ORDER BY seq").all(b.id);
  return { ...b, passengers: pax.map((p) => ({ ...p })) };
}
