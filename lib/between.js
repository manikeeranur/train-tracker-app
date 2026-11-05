// Shared (server + client) helpers for trains-between-stations results.

export function isBetweenList(data) {
  return Array.isArray(data) && data.length > 0 && data.every((t) => t && (t.trainNo || t.train_no) && (t.fromTime || t.from_time));
}

// Providers sometimes put a train number in trainType, and spell types differently
// ("Mail/Express" vs "Mail Express"). Normalise so the type filter stays clean.
function cleanType(v) {
  const s = String(v || "").trim().toUpperCase().replace(/\s*\/\s*/g, " ").replace(/\s+/g, " ");
  if (!s || /^\d+$/.test(s)) return "";
  return s;
}

export function normaliseBetween(data) {
  return data.map((t) => ({
    no: String(t.trainNo ?? t.train_no),
    name: t.trainName ?? t.train_name,
    type: cleanType(t.trainType ?? t.train_type),
    from: t.fromStnCode ?? t.from_stn_code,
    fromName: t.fromStnName ?? t.from_stn_name,
    to: t.toStnCode ?? t.to_stn_code,
    toName: t.toStnName ?? t.to_stn_name,
    src: t.sourceStnName ?? t.source_stn_name,
    dst: t.dstnStnName ?? t.dstn_stn_name,
    dep: t.fromTime ?? t.from_time,
    arr: t.toTime ?? t.to_time,
    travel: t.travelTime ?? t.travel_time,
    days: String(t.runningDays ?? t.running_days ?? ""),
    km: t.distance,
    halts: t.halts,
  }));
}
