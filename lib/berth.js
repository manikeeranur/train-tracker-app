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
  return { status: m[1] === "CONFIRMED" ? "CNF" : m[1], coach: m[2], berth: Number(m[3]), type: m[4] || null };
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
