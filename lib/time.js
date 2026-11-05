// All rail timings are in IST (UTC+05:30), independent of the server timezone.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const currentTime = () => Date.now();

export function todayIST(now = Date.now()) {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return new Date(d.getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

// Epoch ms for an IST wall-clock time: date + minutes after midnight.
export function istToMs(dateStr, minutes = 0) {
  return new Date(`${dateStr}T00:00:00Z`).getTime() - IST_OFFSET_MS + minutes * 60000;
}

// Monday = 0 ... Sunday = 6 (matches train `days` strings).
export function weekdayIndex(dateStr) {
  return (new Date(`${dateStr}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function isValidDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function fmtClock(min) {
  if (min == null) return "--:--";
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function fmtDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
export function fmtDate(dateStr) {
  return dateFmt.format(new Date(`${dateStr}T00:00:00Z`));
}

const dtFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Kolkata",
});
export function fmtDateTime(ms) {
  return `${dtFmt.format(new Date(ms))} IST`;
}

// "23:30" → "11:30 PM"
export function fmt12(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return hhmm || "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}
