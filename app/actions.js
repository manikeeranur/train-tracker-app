"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { col, nextId, one } from "@/lib/db";
import { createSession, destroySession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { BookingError, cancelBooking, createBooking, runNow } from "@/lib/booking";

const safeNext = (n) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/");

// ---------- auth ----------
export async function signup(_prev, form) {
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter your name and a valid email." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (await one("users", { email })) return { error: "An account with this email already exists." };
  const id = await nextId("users");
  try {
    await (await col("users")).insertOne({ id, name, email, password_hash: hashPassword(password), created_at: Date.now() });
  } catch (err) {
    if (err?.code === 11000) return { error: "An account with this email already exists." };
    throw err;
  }
  await createSession(id);
  redirect(safeNext(form.get("next")));
}

export async function login(_prev, form) {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const user = await one("users", { email }, { projection: { id: 1, password_hash: 1 } });
  if (!user || !verifyPassword(password, user.password_hash)) return { error: "Wrong email or password." };
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

// ---------- saved passengers (master list) ----------
function readPassenger(form) {
  return {
    name: String(form.get("name") || "").trim(),
    age: Number(form.get("age")),
    gender: String(form.get("gender") || ""),
    berthPref: String(form.get("berth_pref") || "NP"),
  };
}

async function savePassenger(userId, p) {
  await (await col("passengers")).insertOne({
    id: await nextId("passengers"), user_id: userId, name: p.name, age: p.age, gender: p.gender,
    berth_pref: p.berthPref, id_type: null, id_number: null, created_at: Date.now(),
  });
}

export async function addPassenger(_prev, form) {
  const user = await requireUser("/passengers");
  const p = readPassenger(form);
  if (!p.name || !Number.isInteger(p.age) || p.age < 1 || p.age > 120 || !["M", "F", "T"].includes(p.gender)) {
    return { error: "Enter a valid name, age and gender." };
  }
  await savePassenger(user.id, p);
  revalidatePath("/passengers");
  return { ok: true, at: Date.now() };
}

export async function deletePassenger(form) {
  const user = await requireUser("/passengers");
  await (await col("passengers")).deleteOne({ id: Number(form.get("id")), user_id: user.id });
  revalidatePath("/passengers");
}

// ---------- bookings ----------
export async function book(_prev, form) {
  const user = await requireUser("/");
  let passengers;
  try {
    passengers = JSON.parse(String(form.get("passengers") || "[]")).map((p) => ({
      name: String(p.name || ""),
      age: Number(p.age),
      gender: String(p.gender || ""),
      berthPref: String(p.berthPref || "NP"),
    }));
  } catch {
    return { error: "Invalid passenger data." };
  }
  let id;
  try {
    id = await createBooking({
      userId: user.id,
      trainId: String(form.get("train")),
      journeyDate: String(form.get("date")),
      from: String(form.get("from")),
      to: String(form.get("to")),
      classCode: String(form.get("class")),
      quota: String(form.get("quota")),
      acceptWl: form.get("accept_wl") === "on",
      passengers,
    });
    if (form.get("save_passengers") === "on") {
      const saved = await (await col("passengers")).find({ user_id: user.id }, { projection: { name: 1, age: 1 } }).toArray();
      const key = (name, age) => `${name.trim().toLowerCase()}|${age}`;
      const have = new Set(saved.map((s) => key(s.name, s.age)));
      for (const p of passengers) {
        if (have.has(key(p.name, p.age))) continue;
        have.add(key(p.name, p.age));
        await savePassenger(user.id, { ...p, name: p.name.trim() });
      }
    }
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message };
    throw err;
  }
  redirect(`/bookings/${id}`);
}

export async function cancel(form) {
  const user = await requireUser("/bookings");
  const id = Number(form.get("id"));
  try {
    await cancelBooking(user.id, id);
  } catch (err) {
    if (!(err instanceof BookingError)) throw err;
  }
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${id}`);
}

export async function runScheduledNow(form) {
  const user = await requireUser("/bookings");
  const id = Number(form.get("id"));
  try {
    await runNow(user.id, id);
  } catch (err) {
    if (!(err instanceof BookingError)) throw err;
  }
  revalidatePath(`/bookings/${id}`);
}

// ---------- tracked real PNRs (read-only lookups) ----------
export async function importPnrs(_prev, form) {
  const user = await requireUser("/bookings");
  const { trackPnr, saveParsed } = await import("@/lib/pnrs");
  const { parseIrctcHistory } = await import("@/lib/irctcText");
  const text = String(form.get("text") || "");
  const label = String(form.get("label") || "").trim().slice(0, 40) || null;
  const results = [];
  // 1. Full tickets from IRCTC Booked Ticket History: details saved, no API call.
  const tickets = parseIrctcHistory(text).slice(0, 50);
  await saveParsed(user.id, tickets, label);
  const seen = new Set(tickets.map((t) => t.pnr));
  for (const t of tickets) results.push({ pnr: t.pnr, ok: true, msg: `${t.trainName} ${t.trainNo} · ${t.journeyDate}. Status loads automatically.` });
  // 2. Bare PNRs (typed, SMS, email): fetch status now.
  const bare = [...new Set(text.match(/(?<!\d)\d{10}(?!\d)/g) || [])].filter((p) => !seen.has(p)).slice(0, 20);
  for (const pnr of bare) {
    const r = await trackPnr(user.id, pnr, label);
    results.push({ pnr, ok: !r.error, msg: r.error || r.summary });
  }
  if (!results.length) return { error: "No 10-digit PNR found in the text." };
  revalidatePath("/bookings");
  return { results, at: Date.now() };
}

export async function refreshTracked(form) {
  const user = await requireUser("/pnrs");
  const { refreshPnr } = await import("@/lib/pnrs");
  await refreshPnr(user.id, Number(form.get("id")));
  revalidatePath("/bookings");
  revalidatePath(`/pnrs/${form.get("id")}`);
}

export async function untrack(form) {
  const user = await requireUser("/pnrs");
  const { untrackPnr } = await import("@/lib/pnrs");
  await untrackPnr(user.id, Number(form.get("id")));
  revalidatePath("/bookings");
  redirect("/bookings");
}

// Delete from the My bookings list (stays on the page).
export async function deleteTracked(form) {
  const user = await requireUser("/bookings");
  const { untrackPnr } = await import("@/lib/pnrs");
  await untrackPnr(user.id, Number(form.get("id")));
  revalidatePath("/bookings");
}

export async function deleteCompletedTracked() {
  const user = await requireUser("/bookings");
  const { deleteCompleted } = await import("@/lib/pnrs");
  await deleteCompleted(user.id);
  revalidatePath("/bookings");
}

export async function syncMyPnrs() {
  const user = await requireUser("/pnrs");
  const { syncStale } = await import("@/lib/pnrs");
  const r = await syncStale(user.id);
  if (r.synced) revalidatePath("/bookings");
  return r;
}

export async function namePassenger(form) {
  const user = await requireUser("/bookings");
  const { setPassengerName } = await import("@/lib/pnrs");
  const n = Number(form.get("n"));
  if (!Number.isInteger(n) || n < 1 || n > 12) return;
  await setPassengerName(user.id, Number(form.get("id")), n, form.get("name"));
  revalidatePath("/bookings");
}

// Short live position for a ticket card (read-only). Cached 60s server-side.
export async function liveRunning(trainNo, startDay) {
  await requireUser("/bookings");
  const { fetchLive } = await import("@/lib/live");
  const { normaliseRun } = await import("@/lib/track");
  if (!/^\d{5}$/.test(String(trainNo))) return { error: "Bad train number" };
  const day = String(Math.max(0, Math.min(4, Number(startDay) || 0)));
  const r = await fetchLive("running", { train: String(trainNo), day });
  if (r.error) return { error: "Live position unavailable" };
  const run = normaliseRun(r.data);
  if (!run) return { error: "Live position unavailable" };
  const ended = run.stations.length > 0 && run.stations.every((s) => s.status !== "upcoming");
  // "MANAPARAI JN" → "Manaparai Jn"
  const tc = (v) => (v && v === v.toUpperCase() ? v.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : v);
  run.currentName = tc(run.currentName);
  run.toName = tc(run.toName);
  return {
    started: run.started,
    ended,
    text: !run.started ? "Not started yet" : ended ? `Reached ${run.toName || "destination"}` : run.currentName ? `Near ${run.currentName}` : run.headline || "Running",
    delay: run.delay,
  };
}

// Full live run (route timeline + position) for the tracking page. Cached 60s server-side.
export async function trackRun(trainNo, startDay) {
  await requireUser("/bookings");
  const { fetchLive } = await import("@/lib/live");
  const { normaliseRun } = await import("@/lib/track");
  if (!/^\d{5}$/.test(String(trainNo))) return { error: "Bad train number" };
  const day = String(Math.max(0, Math.min(4, Number(startDay) || 0)));
  const r = await fetchLive("running", { train: String(trainNo), day });
  let run = r.error ? null : normaliseRun(r.data);
  // Live feed down / out of quota / unrecognised: still show the route from the timetable.
  if (!run) {
    run = {
      trainNo: String(trainNo), trainName: null, headline: "Live position unavailable right now",
      subline: r.error || null, nextHint: null, delay: null, progress: null, kmDone: null, kmTotal: null,
      started: false, stations: [], liveDown: true,
    };
  }
  // Not started yet: live feed has no stations, so show the timetable instead (cached 24h).
  if (!run.stations.length) {
    const { stationsFromSchedule } = await import("@/lib/track");
    const sched = await fetchLive("schedule", { train: String(trainNo) });
    if (!sched.error) {
      run.stations = stationsFromSchedule(sched.data);
      run.fromSchedule = true;
      if (!run.kmTotal && run.stations.length) run.kmTotal = run.stations.at(-1).km;
      // Before departure the train is at its origin.
      const first = run.stations[0];
      if (first && !run.started && !run.liveDown) {
        first.status = "current";
        run.currentName = first.name;
        run.progress = 0;
        run.kmDone = 0;
        run.subline = null;
        run.headline = `Yet to start from ${first.name}`;
        run.nextHint = first.std ? `Departs ${first.std}` : run.nextHint;
      }
    }
  }
  if (run.liveDown && !run.stations.length) return { error: r.error || "Live status unavailable right now." };
  return { run, provider: r.provider || "timetable", fetchedAt: Date.now() };
}

// Station suggestions: local list (incl. city names like "Trichy") + provider autocomplete (free tier).
export async function suggestStations(q) {
  const { STATIONS } = await import("@/lib/data");
  const { fetchLive } = await import("@/lib/live");
  const term = String(q || "").trim().toLowerCase().slice(0, 40);
  if (term.length < 2) return [];
  const local = STATIONS.filter(
    (s) => s.code.toLowerCase().startsWith(term) || s.name.toLowerCase().includes(term) || s.city.toLowerCase().startsWith(term)
  ).map((s) => ({ code: s.code, name: s.name, city: s.city }));
  let remote = [];
  const r = await fetchLive("stations", { q: term });
  if (!r.error) {
    const list = Array.isArray(r.data?.results) ? r.data.results : Array.isArray(r.data) ? r.data : [];
    remote = list
      .map((x) => ({ code: x.station_code || x.code || x.stationCode, name: x.station_name || x.name || x.stationName }))
      .filter((x) => x.code && x.name);
  }
  const seen = new Set();
  const merged = [...local, ...remote].filter((x) => !seen.has(x.code) && seen.add(x.code));
  // Exact code ("ms", "tpj") first, then code prefix, then name/city prefix, then the rest.
  const rank = (x) => {
    const c = x.code.toLowerCase();
    const n = x.name.toLowerCase();
    if (c === term) return 0;
    if (c.startsWith(term)) return 1;
    if (n.startsWith(term) || (x.city || "").toLowerCase().startsWith(term)) return 2;
    return 3;
  };
  return merged.map((x, i) => [x, rank(x), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(([x]) => x).slice(0, 8);
}
