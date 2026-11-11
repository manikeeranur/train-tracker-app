// Berth geometry for Indian Railways sleeper/AC coaches. Pure: safe on server and client.

// Bay pattern per class (berth numbers repeat every `bay` berths). Seats (CC/2S/EC) have no bays.
const LAYOUTS = {
  SL: { bay: 8, berths: 80, pattern: ["LB", "MB", "UB", "LB", "MB", "UB", "SL", "SU"] },
  "3A": { bay: 8, berths: 72, pattern: ["LB", "MB", "UB", "LB", "MB", "UB", "SL", "SU"] },
  "3E": { bay: 8, berths: 80, pattern: ["LB", "MB", "UB", "LB", "MB", "UB", "SL", "SU"] },
  "2A": { bay: 6, berths: 54, pattern: ["LB", "UB", "LB", "UB", "SL", "SU"] },
  "1A": { bay: 4, berths: 24, pattern: ["LB", "UB", "LB", "UB"] },
};

export const BERTH_NAMES = {
  LB: "Lower",
  MB: "Middle",
  UB: "Upper",
  SL: "Side lower",
  SU: "Side upper",
};

export function layoutFor(cls) {
  return LAYOUTS[String(cls || "").toUpperCase()] || null;
}

/**
 * "CNF/S1/76/LB", "CNF S1 76", "RAC B1 12", "CNF/B1/53" → { status, coach, berth, type }.
 * Returns null for waitlist / unparseable statuses (no berth yet).
 */
export function parseSeat(text) {
  const m = String(text || "")
    .toUpperCase()
    .match(/\b(CNF|RAC|CONFIRMED)\b[\s/,-]+([A-Z]{1,2}\d{1,2})[\s/,-]+(\d{1,3})(?:[\s/,-]+(LB|MB|UB|SL|SU|SM|WS|MS|AS))?/);
  if (!m) return null;
  const t = m[4] === "WS" ? "W" : m[4] === "MS" ? "M" : m[4] === "AS" ? "A" : m[4] || null;
  return { status: m[1] === "CONFIRMED" ? "CNF" : m[1], coach: m[2], berth: Number(m[3]), type: t };
}

/** Where a berth sits: bay number (1-based), slot within the bay, type and total bays. */
export function placeBerth(cls, berth, type) {
  const L = layoutFor(cls);
  if (!L || !berth) return null;
  const slot = (berth - 1) % L.bay;
  return {
    bay: Math.floor((berth - 1) / L.bay) + 1,
    // Coach sizes vary (ICF vs LHB), so never report fewer bays than the berth needs.
    bays: Math.max(Math.ceil(L.berths / L.bay), Math.floor((berth - 1) / L.bay) + 1),
    slot,
    first: berth - slot, // berth number of the bay's first berth
    type: type && BERTH_NAMES[type] ? type : L.pattern[slot],
    layout: L,
  };
}

// ---------- chair cars (seats in rows, no berths) ----------
// perRow seats across the coach; `split` seats sit left of the aisle. Positions: W window, M middle, A aisle.
// Numbering runs row by row; exact numbering differs a little between coach builds, so positions are approximate.
const SEAT_LAYOUTS = {
  "2S": { perRow: 6, split: 3, seats: 108, pattern: ["W", "M", "A", "A", "M", "W"], facing: true },
  CC: { perRow: 5, split: 3, seats: 78, pattern: ["W", "M", "A", "A", "W"], facing: false },
  EC: { perRow: 4, split: 2, seats: 56, pattern: ["W", "A", "A", "W"], facing: false },
};

export const SEAT_NAMES = { W: "Window", M: "Middle", A: "Aisle" };

export function seatLayoutFor(cls) {
  return SEAT_LAYOUTS[String(cls || "").toUpperCase()] || null;
}

/** Where a chair-car seat sits: row (1-based), position across the row and window/middle/aisle. */
export function placeSeat(cls, seat) {
  const L = seatLayoutFor(cls);
  if (!L || !seat) return null;
  const pos = (seat - 1) % L.perRow;
  const row = Math.floor((seat - 1) / L.perRow) + 1;
  return { row, rows: Math.max(Math.ceil(L.seats / L.perRow), row), pos, type: L.pattern[pos], layout: L };
}

// Typical number of coaches of each class in a rake. Real trains vary, so the UI labels it "typical".
const TYPICAL_COACHES = { SL: 10, "3A": 6, "3E": 4, "2A": 3, "1A": 1, "2S": 4, CC: 6, EC: 2 };

/** Coach codes of this class (S1…S10, B1…B6, D1…), always including the ones you're in. */
export function coachesOf(cls, yourCoaches) {
  const prefix = (yourCoaches[0] || "").replace(/\d+$/, "");
  if (!prefix) return yourCoaches;
  const highest = Math.max(TYPICAL_COACHES[String(cls || "").toUpperCase()] || 1, ...yourCoaches.map((c) => Number(c.slice(prefix.length)) || 0));
  return Array.from({ length: highest }, (_, i) => `${prefix}${i + 1}`);
}
