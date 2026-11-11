import "server-only";
import { col } from "./db";

// Read-only live rail data from third-party RapidAPI providers (one RapidAPI key,
// several free plans). Each lookup tries providers in order and falls through on
// "not subscribed" / quota / errors. Nothing here logs in to IRCTC or books.

const KEY = process.env.RAIL_API_KEY || "";

export const PROVIDERS = {
  yasin: { host: "irctc-unofficial-api.p.rapidapi.com", name: "IRCTC Unofficial API (yasinhirani)", free: 150 },
  amitesh: { host: "irctc-indian-railway-pnr-status.p.rapidapi.com", name: "Indian Railway PNR Status (amiteshgupta)", free: 100 },
  prayan: { host: "irctc-api2.p.rapidapi.com", name: "IRCTC API (prayansil11)", free: 60 },
};

const enc = encodeURIComponent;
const HOUR = 3600e3;

export const ENDPOINTS = {
  pnr: {
    label: "PNR status",
    fields: [["pnr", "PNR number", "10 digits"]],
    validate: (q) => /^\d{10}$/.test(q.pnr) || "Enter a 10-digit PNR.",
    ttl: 60e3,
    try: (q) => [
      ["amitesh", `/getPNRStatus/${enc(q.pnr)}`],
      ["prayan", `/pnrStatus?pnr=${enc(q.pnr)}`],
      ["yasin", `/api/train/pnr/${enc(q.pnr)}`],
    ],
  },
  between: {
    label: "Trains between stations",
    fields: [["from", "From", "MS"], ["to", "To", "MDU"], ["date", "Journey date", "", "date"]],
    optional: ["date"],
    validate: (q) => (/^[A-Z]{2,5}$/.test(q.from) && /^[A-Z]{2,5}$/.test(q.to)) || "Pick From and To stations.",
    ttl: 6 * HOUR,
    try: (q) => [
      ["yasin", `/api/train/trainsBetweenStations?from=${enc(q.from)}&to=${enc(q.to)}`],
      ["amitesh", `/between/${enc(q.from)}/${enc(q.to)}`],
    ],
  },
  seats: {
    label: "Seat availability",
    hidden: true,
    fields: [["from", "From", "MS"], ["to", "To", "MDU"], ["date", "Date", "", "date"]],
    validate: (q) => Boolean(q.from && q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.date)) || "From, To and Date are required.",
    ttl: 10 * 60e3,
    // Provider wants dd-mm-yyyy.
    try: (q) => [["prayan", `/trainAvailability?source=${enc(q.from)}&destination=${enc(q.to)}&date=${q.date.split("-").reverse().join("-")}`]],
  },
  fare: {
    label: "Fare",
    fields: [["from", "From", "MS"], ["to", "To", "MDU"], ["train", "Train no. (optional)", "12637"], ["cls", "Class", "", "select"], ["quota", "Quota", "", "select"]],
    optional: ["train", "cls", "quota"],
    validate: (q) => Boolean(q.from && q.to) || "From and To are required.",
    ttl: 6 * HOUR,
    // Route-level fares only; train/class filtering happens in the UI (provider's per-train lookup is unreliable).
    try: (q) => [["amitesh", `/fare?${new URLSearchParams({ from: q.from, to: q.to, quota: q.quota || "GN" })}`]],
  },
  running: {
    label: "Live running status",
    fields: [["train", "Train no.", "12637"], ["day", "Started (0 = today, 1 = yesterday)", "0"]],
    optional: ["day"],
    validate: (q) => /^\d{5}$/.test(q.train) || "Enter a 5-digit train number.",
    ttl: 60e3,
    try: (q) => [
      ["yasin", `/api/train/liveStatus?trainNo=${enc(q.train)}&startDay=${enc(q.day || "0")}`],
      ["amitesh", `/live-train/${enc(q.train)}/status`],
      ["prayan", `/liveTrain?trainNumber=${enc(q.train)}&startDay=${enc(q.day || "0")}`],
    ],
  },
  schedule: {
    label: "Train schedule",
    fields: [["train", "Train no.", "12637"]],
    validate: (q) => /^\d{5}$/.test(q.train) || "Enter a 5-digit train number.",
    ttl: 24 * HOUR,
    try: (q) => [
      ["yasin", `/api/train/${enc(q.train)}/info`],
      ["amitesh", `/schedule/${enc(q.train)}`],
      ["prayan", `/trainSchedule?trainNumber=${enc(q.train)}`],
    ],
  },
  stations: {
    label: "Station search",
    hidden: true,
    fields: [["q", "Station", "Chennai"]],
    validate: (q) => String(q.q || "").length >= 2 || "Type at least 2 letters.",
    ttl: 7 * 24 * HOUR,
    try: (q) => [["amitesh", `/autocomplete/station/${enc(q.q.toLowerCase())}?limit=8`]],
  },
  station: {
    label: "Live station",
    fields: [["code", "Station code", "MAS"]],
    validate: (q) => /^[A-Z]{2,5}$/.test(q.code) || "Enter a station code.",
    ttl: 60e3,
    try: (q) => [
      ["yasin", `/api/train/liveStationAt/${enc(q.code)}`],
      ["amitesh", `/station/${enc(q.code)}/trains`],
      ["prayan", `/liveStation?source=${enc(q.code)}&hours=2`],
    ],
  },
};

// Dropdown options for select fields ([value, label]); "" means "any".
export const SELECT_OPTIONS = {
  cls: [
    ["", "Any class"],
    ["1A", "1A · First AC"],
    ["2A", "2A · AC 2 Tier"],
    ["3A", "3A · AC 3 Tier"],
    ["3E", "3E · AC 3 Economy"],
    ["EC", "EC · Exec. Chair Car"],
    ["CC", "CC · AC Chair Car"],
    ["SL", "SL · Sleeper"],
    ["2S", "2S · Second Sitting"],
  ],
  quota: [
    ["GN", "General"],
    ["TQ", "Tatkal"],
    ["PT", "Premium Tatkal"],
    ["LD", "Ladies"],
    ["SS", "Senior Citizen"],
  ],
};

export const isConfigured = () => Boolean(KEY);

const g = globalThis;
const cache = g.__railgoLiveCache ?? (g.__railgoLiveCache = new Map());
const benched = g.__railgoLiveBench ?? (g.__railgoLiveBench = new Map()); // provider -> { until, reason }

async function logCall(pid, kind, path, r) {
  try {
    await (await col("api_calls")).insertOne({
      created_at: Date.now(), provider: pid, kind, path, status: r.status ?? null, ok: r.ok ? 1 : 0,
      ms: r.ms ?? null, error: r.ok ? null : String(r.reason).slice(0, 300),
    });
  } catch (err) {
    console.error("[railgo] api_calls log failed", err);
  }
}

async function callProvider(pid, kind, path) {
  const started = Date.now();
  let r;
  try {
    r = await rawCall(pid, path);
  } catch (err) {
    r = { ok: false, reason: err.name === "TimeoutError" ? "timed out" : err.message, ms: Date.now() - started, thrown: true };
  }
  await logCall(pid, kind, path, r);
  return r;
}

async function rawCall(pid, path) {
  const { host } = PROVIDERS[pid];
  const started = Date.now();
  const res = await fetch(`https://${host}${path}`, {
    headers: { "x-rapidapi-key": KEY, "x-rapidapi-host": host, accept: "application/json" },
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  const ms = Date.now() - started;
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, status: res.status, reason: `non-JSON response (HTTP ${res.status})`, ms };
  }
  if (!res.ok) return { ok: false, status: res.status, reason: body?.message || `HTTP ${res.status}`, body, ms };
  const failed = body?.success === false || body?.status === false || (body?.error && body?.data == null);
  if (failed) return { ok: false, status: 200, reason: body.message || body.error || "provider error", body, ms, final: true };
  return { ok: true, status: res.status, data: body?.data ?? body, ms };
}

export async function fetchLive(kind, query, { fresh = false } = {}) {
  const ep = ENDPOINTS[kind];
  if (!ep) return { error: "Unknown lookup." };
  const ok = ep.validate(query);
  if (ok !== true) return { error: typeof ok === "string" && ok.length > 6 ? ok : "Please check the inputs." };
  if (!KEY) return { error: "RAIL_API_KEY is not set. Add it to .env.local and restart the server." };

  const cacheKey = `${kind}|${JSON.stringify(query)}`;
  const hit = cache.get(cacheKey);
  if (!fresh && hit && Date.now() - hit.at < ep.ttl) return { ...hit.value, cached: true };

  const attempts = [];
  for (const [pid, path] of ep.try(query)) {
    const bench = benched.get(pid);
    if (bench && bench.until > Date.now()) {
      attempts.push(`${PROVIDERS[pid].name}: skipped (${bench.reason})`);
      continue;
    }
    const r = await callProvider(pid, kind, path);
    if (r.ok) {
      const value = { data: r.data, ms: r.ms, provider: PROVIDERS[pid].name, attempts };
      cache.set(cacheKey, { at: Date.now(), value });
      return value;
    }
    // Not subscribed / quota / rate limit: stop using this provider for an hour.
    if ([401, 403, 429].includes(r.status)) {
      const reason = r.status === 429 ? "quota or rate limit hit" : "not subscribed";
      benched.set(pid, { until: Date.now() + HOUR, reason });
    }
    attempts.push(`${PROVIDERS[pid].name}: ${r.reason}`);
    // A provider that answered "invalid PNR" etc. is a real answer, not an outage.
    if (r.final) return { error: r.reason, raw: r.body, attempts, provider: PROVIDERS[pid].name };
  }
  return { error: "No provider could answer this right now.", attempts };
}
