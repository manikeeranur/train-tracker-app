// Booking engine: create, auto-book scheduled bookings, cancel, promote waitlist.
import { randomInt } from "node:crypto";
import { CLASSES } from "./data";
import { col, many, nextId, one, tx } from "./db";
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

async function newPnr(session) {
  for (;;) {
    const pnr = String(randomInt(4, 10)) + String(randomInt(0, 1e9)).padStart(9, "0");
    if (!(await one("bookings", { pnr }, { session, projection: { id: 1 } }))) return pnr;
  }
}

/**
 * Create a booking. If the booking window is already open it's allocated
 * immediately; otherwise it's stored as SCHEDULED and the scheduler books it
 * the moment the window opens.
 */
export async function createBooking({ userId, trainId, journeyDate, from, to, classCode, quota, passengers, acceptWl }) {
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

  const id = await tx(async (session) => {
    const id = await nextId("bookings", session);
    let total = 0;
    const pax = [];
    for (const [i, p] of passengers.entries()) {
      const fare = fareFor(train, classCode, quota, seg.km, p.age);
      total += fare;
      pax.push({
        id: await nextId("booking_passengers", session), booking_id: id, seq: i + 1, name: p.name.trim(), age: p.age,
        gender: p.gender, berth_pref: p.berthPref || "NP", status: "PENDING", coach: null, berth_no: null,
        berth_type: null, wl_no: null, fare,
      });
    }
    await (await col("bookings")).insertOne(
      {
        id, user_id: userId, pnr: null, train_id: train.id, journey_date: journeyDate, run_date: originDate(journeyDate, seg.from),
        from_code: from, to_code: to, class_code: classCode, quota, status: scheduled ? "SCHEDULED" : "PROCESSING",
        accept_wl: acceptWl ? 1 : 0, scheduled_for: scheduled ? win.opensAt : now, fare_total: total, note: null,
        created_at: now, booked_at: null, attempt_ms: null,
      },
      { session }
    );
    await (await col("booking_passengers")).insertMany(pax, { session });
    return id;
  });

  if (!scheduled) await allocate(id, now);
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

/** Allocate berths for a SCHEDULED / PROCESSING booking. Runs in one transaction. */
export async function allocate(bookingId, now = Date.now()) {
  return tx(async (session) => {
    const bookings = await col("bookings");
    const bp = await col("booking_passengers");
    const b = await one("bookings", { id: bookingId }, { session });
    if (!b || !["SCHEDULED", "PROCESSING"].includes(b.status)) return null;
    const train = getTrain(b.train_id);
    const pax = await many("booking_passengers", { booking_id: bookingId }, { session, sort: { seq: 1 } });
    const win = bookingWindow(train, b.journey_date, b.from_code, b.class_code, b.quota);
    const latency = b.scheduled_for ? Math.max(0, now - b.scheduled_for) : 0;
    const fail = (note) => bookings.updateOne({ id: bookingId }, { $set: { status: "FAILED", note, attempt_ms: latency } }, { session });

    if (now >= win.closesAt) {
      await fail("Booking window closed before the booking could run.");
      return "FAILED";
    }

    const free = (await inventory(train, b.run_date, b.class_code, b.quota, now, session)).berths.filter((x) => x.free);
    const needBerth = pax.filter((p) => p.age >= 5);
    if (!b.accept_wl && free.length < needBerth.length) {
      await fail(`Only ${free.length} berth(s) left for ${needBerth.length} passenger(s); waitlist not accepted.`);
      return "FAILED";
    }

    let wlBase = (await availability(train, b.run_date, b.class_code, b.quota, now, session)).wl;
    const setPax = (id, status, coach, berthNo, type, wlNo) =>
      bp.updateOne({ id }, { $set: { status, coach, berth_no: berthNo, berth_type: type, wl_no: wlNo } }, { session });
    const holds = [];
    let firstCoach = null;
    let anyWl = false;
    for (const p of pax) {
      if (p.age < 5) {
        await setPax(p.id, "CNF", null, null, null, null); // child below 5: no berth, travels free
        continue;
      }
      const berth = pickBerth(free, p, firstCoach);
      if (berth) {
        firstCoach ??= berth.coach;
        await setPax(p.id, "CNF", berth.coach, berth.berthNo, berth.type, null);
        holds.push({ train_id: b.train_id, journey_date: b.run_date, class_code: b.class_code, coach: berth.coach, berth_no: berth.berthNo, passenger_id: p.id });
      } else {
        anyWl = true;
        await setPax(p.id, "WL", null, null, null, ++wlBase);
      }
    }
    // Unique index on the berth: a concurrent allocation aborts this transaction instead of double-booking.
    if (holds.length) await (await col("seat_holds")).insertMany(holds, { session });
    const status = anyWl ? "WAITLIST" : "CONFIRMED";
    await bookings.updateOne(
      { id: bookingId },
      { $set: { status, pnr: await newPnr(session), booked_at: now, attempt_ms: latency, note: null } },
      { session }
    );
    return status;
  });
}

/** Book everything whose window has opened (scheduler tick). */
export async function processDueBookings(now = Date.now()) {
  const due = await many("bookings", { status: "SCHEDULED", scheduled_for: { $lte: now } }, { sort: { scheduled_for: 1, id: 1 }, limit: 50, projection: { id: 1 } });
  for (const { id } of due) {
    try {
      await allocate(id, Date.now());
    } catch (err) {
      console.error(`[railgo] auto-book ${id} failed`, err);
      await (await col("bookings")).updateOne({ id, status: "SCHEDULED" }, { $set: { status: "FAILED", note: `Internal error: ${err.message}` } });
    }
  }
  return due.length;
}

/** Demo helper: run a scheduled booking right now, as if the window just opened. */
export async function runNow(userId, bookingId) {
  const b = await one("bookings", { id: bookingId, user_id: userId });
  if (!b || b.status !== "SCHEDULED") throw new BookingError("Only scheduled bookings can be run.");
  const now = Date.now();
  await (await col("bookings")).updateOne({ id: bookingId }, { $set: { scheduled_for: now } });
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

export async function cancelBooking(userId, bookingId) {
  const result = await tx(async (session) => {
    const b = await one("bookings", { id: bookingId, user_id: userId }, { session });
    if (!b) throw new BookingError("Booking not found.");
    if (!["SCHEDULED", "CONFIRMED", "WAITLIST"].includes(b.status)) throw new BookingError("This booking can't be cancelled.");
    const pax = await many("booking_passengers", { booking_id: bookingId }, { session });
    const refund = refundFor(b, pax);
    await (await col("seat_holds")).deleteMany({ passenger_id: { $in: pax.map((p) => p.id) } }, { session });
    await (await col("booking_passengers")).updateMany({ booking_id: bookingId }, { $set: { status: "CAN" } }, { session });
    await (await col("bookings")).updateOne({ id: bookingId }, { $set: { status: "CANCELLED", note: `Refund ₹${refund}` } }, { session });
    return { b, hadSeats: pax.some((p) => p.status === "CNF") };
  });
  if (result.hadSeats) await promoteWaitlist(result.b.train_id, result.b.run_date, result.b.class_code, result.b.quota);
  return result;
}

/** After a cancellation, move waitlisted passengers (oldest first) into free berths. */
export async function promoteWaitlist(trainId, runDate, classCode, quota) {
  await tx(async (session) => {
    const train = getTrain(trainId);
    const free = (await inventory(train, runDate, classCode, quota, Date.now(), session)).berths.filter((x) => x.free);
    if (!free.length) return;
    const bookings = await many("bookings", { train_id: trainId, run_date: runDate, class_code: classCode, quota }, { session });
    const bookedAt = new Map(bookings.map((b) => [b.id, b.booked_at ?? 0]));
    const wl = (await many("booking_passengers", { booking_id: { $in: [...bookedAt.keys()] }, status: "WL" }, { session }))
      .sort((a, b) => bookedAt.get(a.booking_id) - bookedAt.get(b.booking_id) || a.seq - b.seq);
    const touched = new Set();
    for (const p of wl) {
      const berth = pickBerth(free, p, null);
      if (!berth) break;
      await (await col("booking_passengers")).updateOne(
        { id: p.id },
        { $set: { status: "CNF", coach: berth.coach, berth_no: berth.berthNo, berth_type: berth.type, wl_no: null } },
        { session }
      );
      await (await col("seat_holds")).insertOne(
        { train_id: trainId, journey_date: runDate, class_code: classCode, coach: berth.coach, berth_no: berth.berthNo, passenger_id: p.id },
        { session }
      );
      touched.add(p.booking_id);
    }
    for (const id of touched) {
      const left = await one("booking_passengers", { booking_id: id, status: "WL" }, { session, projection: { id: 1 } });
      if (!left) await (await col("bookings")).updateOne({ id }, { $set: { status: "CONFIRMED" } }, { session });
    }
  });
}

async function withPassengers(b) {
  if (!b) return null;
  return { ...b, passengers: await many("booking_passengers", { booking_id: b.id }, { sort: { seq: 1 } }) };
}

export async function getBooking(userId, id) {
  return withPassengers(await one("bookings", { id, user_id: userId }));
}

export async function listBookings(userId) {
  const rows = await many("bookings", { user_id: userId }, { sort: { created_at: -1 } });
  return rows.sort((a, b) => (a.status === "SCHEDULED" ? 0 : 1) - (b.status === "SCHEDULED" ? 0 : 1));
}

export async function findByPnr(pnr) {
  return withPassengers(await one("bookings", { pnr }));
}
