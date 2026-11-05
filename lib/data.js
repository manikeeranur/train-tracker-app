// Static reference data: stations, train routes, coach layouts and fares.
// Everything here is simulated data for RailGo's own booking system.

export const STATIONS = [
  { code: "MAS", name: "Chennai Central", city: "Chennai" },
  { code: "MS", name: "Chennai Egmore", city: "Chennai" },
  { code: "CGL", name: "Chengalpattu Jn", city: "Chengalpattu" },
  { code: "VM", name: "Villupuram Jn", city: "Villupuram" },
  { code: "TPJ", name: "Tiruchchirappalli Jn", city: "Trichy" },
  { code: "DG", name: "Dindigul Jn", city: "Dindigul" },
  { code: "MDU", name: "Madurai Jn", city: "Madurai" },
  { code: "VPT", name: "Virudhunagar Jn", city: "Virudhunagar" },
  { code: "TEN", name: "Tirunelveli Jn", city: "Tirunelveli" },
  { code: "NCJ", name: "Nagercoil Jn", city: "Nagercoil" },
  { code: "CAPE", name: "Kanniyakumari", city: "Kanyakumari" },
  { code: "KPD", name: "Katpadi Jn", city: "Vellore" },
  { code: "JTJ", name: "Jolarpettai Jn", city: "Jolarpettai" },
  { code: "SA", name: "Salem Jn", city: "Salem" },
  { code: "ED", name: "Erode Jn", city: "Erode" },
  { code: "TUP", name: "Tiruppur", city: "Tiruppur" },
  { code: "CBE", name: "Coimbatore Jn", city: "Coimbatore" },
  { code: "PGT", name: "Palakkad Jn", city: "Palakkad" },
  { code: "TCR", name: "Thrissur", city: "Thrissur" },
  { code: "ERS", name: "Ernakulam Jn", city: "Kochi" },
  { code: "TVC", name: "Thiruvananthapuram Central", city: "Thiruvananthapuram" },
  { code: "SBC", name: "KSR Bengaluru", city: "Bengaluru" },
  { code: "BNC", name: "Bengaluru Cantt", city: "Bengaluru" },
  { code: "SC", name: "Secunderabad Jn", city: "Hyderabad" },
  { code: "BZA", name: "Vijayawada Jn", city: "Vijayawada" },
  { code: "NGP", name: "Nagpur Jn", city: "Nagpur" },
  { code: "BPL", name: "Bhopal Jn", city: "Bhopal" },
  { code: "NDLS", name: "New Delhi", city: "Delhi" },
  { code: "PUNE", name: "Pune Jn", city: "Pune" },
  { code: "CSMT", name: "Mumbai CSMT", city: "Mumbai" },
];

export const STATION_MAP = Object.fromEntries(STATIONS.map((s) => [s.code, s]));

// Class definitions. `pattern` is the berth/seat type cycle inside a coach.
export const CLASSES = {
  "1A": { name: "First AC", prefix: "H", berths: 24, pattern: ["LB", "UB", "LB", "UB"], perKm: 3.8, min: 900, ac: true, sleeper: true },
  "2A": { name: "AC 2 Tier", prefix: "A", berths: 48, pattern: ["LB", "UB", "LB", "UB", "SL", "SU"], perKm: 2.25, min: 600, ac: true, sleeper: true },
  "3A": { name: "AC 3 Tier", prefix: "B", berths: 64, pattern: ["LB", "MB", "UB", "LB", "MB", "UB", "SL", "SU"], perKm: 1.55, min: 450, ac: true, sleeper: true },
  "SL": { name: "Sleeper", prefix: "S", berths: 72, pattern: ["LB", "MB", "UB", "LB", "MB", "UB", "SL", "SU"], perKm: 0.6, min: 180, ac: false, sleeper: true },
  "CC": { name: "AC Chair Car", prefix: "C", berths: 78, pattern: ["WS", "MS", "AS", "AS", "MS", "WS"], perKm: 1.3, min: 300, ac: true, sleeper: false },
  "2S": { name: "Second Sitting", prefix: "D", berths: 100, pattern: ["WS", "MS", "AS", "AS", "MS", "WS"], perKm: 0.35, min: 90, ac: false, sleeper: false },
};

export const BERTH_LABELS = {
  LB: "Lower",
  MB: "Middle",
  UB: "Upper",
  SL: "Side Lower",
  SU: "Side Upper",
  WS: "Window",
  MS: "Middle",
  AS: "Aisle",
};

export const QUOTAS = {
  GN: "General",
  TQ: "Tatkal",
  LD: "Ladies",
  SS: "Senior Citizen",
};

// Route definitions. stops: [code, km from origin, halt minutes].
// Times are generated from `start` (HH:MM) and `speed` (avg km/h incl. halts).
const ROUTES = [
  {
    number: "12635", name: "Vaigai Express", start: "13:40", speed: 62, days: "1111111",
    classes: { CC: 4, "2S": 8 },
    stops: [["MS", 0, 0], ["CGL", 56, 2], ["VM", 159, 3], ["TPJ", 337, 5], ["DG", 432, 2], ["MDU", 493, 0]],
  },
  {
    number: "12637", name: "Pandian Express", start: "21:40", speed: 55, days: "1111111",
    classes: { "1A": 1, "2A": 2, "3A": 5, SL: 9 },
    stops: [["MS", 0, 0], ["CGL", 56, 2], ["VM", 159, 5], ["TPJ", 337, 5], ["DG", 432, 2], ["MDU", 493, 0]],
  },
  {
    number: "12633", name: "Kanyakumari Express", start: "17:20", speed: 56, days: "1111111",
    classes: { "2A": 1, "3A": 4, SL: 10 },
    stops: [["MS", 0, 0], ["VM", 159, 5], ["TPJ", 337, 5], ["MDU", 493, 5], ["VPT", 536, 2], ["TEN", 646, 5], ["NCJ", 717, 3], ["CAPE", 737, 0]],
  },
  {
    number: "12631", name: "Nellai Express", start: "20:10", speed: 57, days: "1111111",
    classes: { "1A": 1, "2A": 2, "3A": 5, SL: 8 },
    stops: [["MS", 0, 0], ["CGL", 56, 2], ["VM", 159, 5], ["TPJ", 337, 5], ["DG", 432, 2], ["MDU", 493, 5], ["VPT", 536, 2], ["TEN", 646, 0]],
  },
  {
    number: "12675", name: "Kovai Express", start: "06:10", speed: 66, days: "1111111",
    classes: { CC: 5, "2S": 10 },
    stops: [["MAS", 0, 0], ["KPD", 129, 2], ["JTJ", 214, 2], ["SA", 335, 3], ["ED", 395, 5], ["TUP", 445, 2], ["CBE", 496, 0]],
  },
  {
    number: "12671", name: "Nilgiri Express", start: "21:05", speed: 58, days: "1111111",
    classes: { "1A": 1, "2A": 2, "3A": 4, SL: 9 },
    stops: [["MAS", 0, 0], ["KPD", 129, 3], ["JTJ", 214, 3], ["SA", 335, 5], ["ED", 395, 5], ["TUP", 445, 2], ["CBE", 496, 0]],
  },
  {
    number: "22639", name: "Alleppey Superfast", start: "20:45", speed: 60, days: "1111111",
    classes: { "2A": 2, "3A": 5, SL: 8 },
    stops: [["MAS", 0, 0], ["KPD", 129, 2], ["JTJ", 214, 2], ["SA", 335, 3], ["ED", 395, 5], ["CBE", 496, 5], ["PGT", 550, 5], ["TCR", 625, 3], ["ERS", 699, 0]],
  },
  {
    number: "12695", name: "Trivandrum Superfast", start: "15:20", speed: 61, days: "1111111",
    classes: { "2A": 1, "3A": 5, SL: 8 },
    stops: [["MAS", 0, 0], ["KPD", 129, 2], ["SA", 335, 5], ["ED", 395, 5], ["CBE", 496, 5], ["PGT", 550, 5], ["TCR", 625, 3], ["ERS", 699, 5], ["TVC", 921, 0]],
  },
  {
    number: "12007", name: "Shatabdi Express", start: "06:00", speed: 72, days: "1111101",
    classes: { CC: 7 },
    stops: [["MAS", 0, 0], ["KPD", 129, 2], ["BNC", 351, 2], ["SBC", 359, 0]],
  },
  {
    number: "12657", name: "Bangalore Mail", start: "22:40", speed: 52, days: "1111111",
    classes: { "1A": 1, "2A": 2, "3A": 4, SL: 9 },
    stops: [["MAS", 0, 0], ["KPD", 129, 5], ["JTJ", 214, 3], ["BNC", 351, 3], ["SBC", 359, 0]],
  },
  {
    number: "12759", name: "Charminar Express", start: "18:10", speed: 58, days: "1111111",
    classes: { "1A": 1, "2A": 2, "3A": 6, SL: 10 },
    stops: [["MAS", 0, 0], ["BZA", 431, 10], ["SC", 784, 0]],
  },
  {
    number: "12621", name: "Tamil Nadu Express", start: "22:00", speed: 75, days: "1111111",
    classes: { "1A": 1, "2A": 3, "3A": 8, SL: 8 },
    stops: [["MAS", 0, 0], ["BZA", 431, 10], ["NGP", 1092, 10], ["BPL", 1482, 10], ["NDLS", 2182, 0]],
  },
  {
    number: "22159", name: "Mumbai Superfast", start: "12:45", speed: 58, days: "1111111",
    classes: { "2A": 2, "3A": 6, SL: 9 },
    stops: [["MAS", 0, 0], ["KPD", 129, 3], ["JTJ", 214, 3], ["PUNE", 1088, 10], ["CSMT", 1279, 0]],
  },
  {
    number: "16127", name: "Guruvayur Express", start: "23:15", speed: 50, days: "1111111",
    classes: { "3A": 2, SL: 8, "2S": 3 },
    stops: [["MS", 0, 0], ["VM", 159, 5], ["TPJ", 337, 5], ["MDU", 493, 5], ["TEN", 646, 5], ["NCJ", 717, 5], ["TVC", 788, 0]],
  },
];

function toMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function buildStops(route, startMin, ordered) {
  const out = [];
  let t = startMin;
  let prevKm = ordered[0][1];
  ordered.forEach(([code, km, halt], i) => {
    const dist = Math.abs(km - prevKm);
    if (i > 0) t += Math.round((dist / route.speed) * 60);
    const arr = i === 0 ? null : t;
    const dep = i === ordered.length - 1 ? null : t + (i === 0 ? 0 : halt);
    out.push({ code, km: Math.abs(km - ordered[0][1]), arr, dep, seq: i });
    if (dep != null) t = dep;
    prevKm = km;
  });
  return out;
}

// Build both directions for each route. Return trains get number + 1.
export const TRAINS = ROUTES.flatMap((r) => {
  const up = {
    id: r.number,
    number: r.number,
    name: r.name,
    days: r.days,
    classes: r.classes,
    stops: buildStops(r, toMin(r.start), r.stops),
  };
  const revStops = [...r.stops].reverse();
  // Return run departs ~12h offset so the timetable looks natural.
  const revStart = (toMin(r.start) + 11 * 60 + 25) % (24 * 60);
  const downNumber = String(Number(r.number) + 1);
  const down = {
    id: downNumber,
    number: downNumber,
    name: r.name,
    days: r.days,
    classes: r.classes,
    stops: buildStops(r, revStart, revStops),
  };
  return [up, down];
});

export const TRAIN_MAP = Object.fromEntries(TRAINS.map((t) => [t.id, t]));
