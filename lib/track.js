// Normalise live running status from either provider into one shape.
// Pure function: safe on server and client.

const num = (v) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const clean = (s) => (s == null ? null : String(s).replace(/~+$/, "").trim());

function fromYasin(d) {
  const mapStn = (s, status) => ({
    code: s.station_code,
    name: clean(s.station_name),
    sta: s.sta || null,
    std: s.std || null,
    eta: s.eta || null,
    etd: s.etd || null,
    platform: s.platform_number ?? null,
    km: num(s.distance_from_source),
    delay: num(s.arrival_delay),
    day: num(s.a_day) ?? 0,
    status,
  });
  const done0 = num(d.distance_from_source);
  // Each halt carries the stations the train runs through without stopping, up to the next halt.
  const withNonStops = (s, status) => [
    mapStn(s, status),
    ...(s.non_stops || []).map((n) => {
      const km = num(n.distance_from_source);
      return {
        code: n.station_code || null,
        name: clean(n.station_name),
        sta: null, std: null, eta: null, etd: null, platform: null,
        km,
        delay: null,
        day: num(s.a_day) ?? 0,
        status: km != null && done0 != null && km <= done0 ? "passed" : "upcoming",
        nonStop: true,
      };
    }),
  ];
  const prev = (d.previous_stations || []).flatMap((s) => withNonStops(s, "passed"));
  const up = (d.upcoming_stations || []).flatMap((s) => withNonStops(s, "upcoming"));
  // The train is "at" the first upcoming station only if it's essentially there.
  const notes = (d.current_location_info || []).map((x) => x.message).filter(Boolean);
  const bubble = d.bubble_message;
  const total = num(d.total_distance);
  const done = num(d.distance_from_source);
  return {
    trainNo: String(d.train_number ?? ""),
    trainName: d.train_name,
    from: d.source,
    fromName: clean(d.source_stn_name),
    to: d.destination,
    toName: clean(d.dest_stn_name),
    startDate: d.train_start_date,
    updated: d.update_time,
    headline: notes[0] || d.title || d.new_message || null,
    subline: notes[1] || (d.title && d.new_message ? d.new_message : null),
    nextHint: bubble?.station_name ? `${bubble.message_type || ""} ${clean(bubble.station_name)}${bubble.station_time ? ` · ${bubble.station_time}` : ""}`.trim() : null,
    currentCode: d.current_station_code,
    currentName: clean(d.current_station_name),
    delay: num(d.delay),
    progress: total && done != null ? Math.max(0, Math.min(100, (done / total) * 100)) : null,
    kmDone: done,
    kmTotal: total,
    started: (d.previous_stations || []).length > 0,
    stations: [...prev, ...up],
  };
}

function fromAmitesh(d) {
  const stations = (d.stations || []).map((s) => ({
    code: null,
    name: clean(s.station_name),
    sta: s.arrival && s.arrival !== "First" ? s.arrival : null,
    std: s.departure && s.departure !== "Last" ? s.departure : null,
    eta: null,
    etd: null,
    platform: s.platform ?? null,
    km: null,
    delay: num(s.arrival_delay_minutes) ?? num(s.departure_delay_minutes),
    day: 0,
    status: s.status === "departed" ? "passed" : s.status === "current" ? "current" : "upcoming",
  }));
  const cur = stations.find((s) => s.status === "current");
  return {
    trainNo: String(d.train_no ?? ""),
    trainName: d.train_name,
    from: d.from_station,
    fromName: stations[0]?.name,
    to: null,
    toName: stations.at(-1)?.name,
    startDate: d.start_date,
    updated: d.last_update,
    headline: d.position || null,
    subline: null,
    nextHint: d.next_station ? `Next: ${d.next_station}` : null,
    currentCode: null,
    currentName: cur?.name || clean(d.current_station),
    delay: num(d.delay_minutes),
    progress: num(d.progress_percent),
    kmDone: null,
    kmTotal: null,
    started: stations.some((s) => s.status !== "upcoming"),
    stations,
  };
}

const key = (s) => String(s || "").toUpperCase().replace(/[^A-Z]/g, "");

// Providers sometimes send blank placeholder rows and lag the "current" marker behind
// the headline ("Arrived at X"). Clean both up.
function tidy(run) {
  const arrived = String(run.headline || "").match(/(?:Arrived at|Departed from|Reached)\s+([^(]+?)(?:\s*\(|\s+at\s|$)/i);
  const arrivedName = arrived ? arrived[1].replace(/~+$/, "").trim() : null;
  // A blank row right after the last passed station is the station the train is at.
  let filled = false;
  run.stations = run.stations
    .map((s) => {
      if (s.name || s.code || filled || !arrivedName) return s;
      filled = true;
      const at = String(run.headline).match(/\bat\s+(\d{1,2}:\d{2})/);
      return { ...s, name: arrivedName, km: s.km || null, eta: at ? at[1] : s.eta };
    })
    .filter((s) => s.name || s.code);
  run.stations.forEach((s) => {
    if (!Number(s.platform)) s.platform = null;
  });
  const targets = [run.currentCode, arrived?.[1]].filter(Boolean).map(key);
  const idx = run.stations.findIndex((s) => targets.some((t) => t && (s.code === t || (key(s.name) && (key(s.name).startsWith(t.slice(0, 8)) || t.startsWith(key(s.name).slice(0, 8)))))));
  if (idx !== -1 && /arrived|reached/i.test(run.headline || "")) {
    run.stations.forEach((s, i) => {
      if (i < idx) s.status = "passed";
      else if (i === idx) s.status = "current";
      else if (s.status === "current") s.status = "upcoming";
    });
  }
  for (const k of ["headline", "subline", "nextHint", "currentName"]) if (run[k]) run[k] = String(run[k]).replace(/~/g, "").replace(/\s+/g, " ").trim();
  // "2026-11-05 18:04:00 +0530" / "05-Nov-2026 18:04" → "18:04"
  const t = String(run.updated || "").match(/(\d{1,2}:\d{2})/);
  run.updatedTime = t ? t[1] : null;
  return run;
}

export function normaliseRun(data) {
  if (!data || typeof data !== "object") return null;
  if ("upcoming_stations" in data || "previous_stations" in data || "current_station_code" in data) return tidy(fromYasin(data));
  if (Array.isArray(data.stations)) return tidy(fromAmitesh(data));
  return null;
}

// Timetable → timeline rows, used before the train starts (live feed has no stations then).
export function stationsFromSchedule(data) {
  const route = Array.isArray(data?.route) ? data.route : Array.isArray(data?.stations) ? data.stations : Array.isArray(data) ? data : [];
  const t = (v) => (v && /^\d{1,2}:\d{2}/.test(String(v)) ? String(v).slice(0, 5) : null);
  return route
    .map((r) => ({
      code: r.stationCode || r.station_code || r.code || null,
      name: clean(r.stationName || r.station_name || r.name),
      sta: t(r.arrival ?? r.arrivalTime ?? r.sta),
      std: t(r.departure ?? r.departureTime ?? r.std),
      eta: null,
      etd: null,
      platform: Number(r.platform ?? r.platform_number) || null,
      km: num(r.distance ?? r.distance_from_source),
      delay: null,
      day: num(r.day) ?? 0,
      status: "upcoming",
    }))
    .filter((s) => s.name || s.code);
}

/**
 * Add the stations a train passes without stopping (taken from another run of the same train,
 * e.g. yesterday's) after each timetable halt. Halts keep their timetable timings.
 */
export function withNonStops(halts, full) {
  if (!full?.stations?.some((s) => s.nonStop)) return halts;
  const after = new Map(); // halt code -> non-stop stations up to the next halt
  let cur = null;
  for (const s of full.stations) {
    if (!s.nonStop) {
      cur = s.code;
      if (cur) after.set(cur, []);
    } else if (cur && after.has(cur)) {
      after.get(cur).push(s);
    }
  }
  return halts.flatMap((h) => [h, ...(after.get(h.code) || []).map((n) => ({ ...n, status: "upcoming", day: h.day }))]);
}
