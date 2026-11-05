// Parse text copied from IRCTC "My Bookings / Booked Ticket History".
// Pure functions (no DB, no network) so they can run in scripts and tests too.
//
// Each ticket looks like (newlines may be missing when copied):
//   ROCKFORT SF EXP (12653)PNR: 4660279737
//   23:30 | Chennai Egmore (MS)05h 30m05:00 | Tiruchchirappalli Jn (TPJ)Fri, 06 NovSat, 07 Nov
//   STATUS: BOOKEDBoarding Station: Chennai Egmore (MS)

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const DAY = "(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)";

const TICKET = new RegExp(
  String.raw`(?<train>[A-Z0-9][A-Z0-9 .&'/-]*?)\s*\((?<trainNo>\d{5})\)\s*PNR:\s*(?<pnr>\d{10})` +
    String.raw`\s*(?<dep>\d{2}:\d{2})\s*\|\s*(?<fromName>[^()|]+?)\s*\((?<from>[A-Z]{1,5})\)` +
    String.raw`\s*(?<dur>\d{1,2}h\s*\d{1,2}m)\s*(?<arr>\d{2}:\d{2})\s*\|\s*(?<toName>[^()|]+?)\s*\((?<to>[A-Z]{1,5})\)` +
    String.raw`\s*${DAY},\s*(?<d1>\d{1,2}\s+[A-Za-z]{3})\s*${DAY},\s*(?<d2>\d{1,2}\s+[A-Za-z]{3})` +
    String.raw`(?:\s*STATUS:\s*(?<status>[A-Z /-]+?)\s*(?=Boarding|$|\n|[A-Z][A-Z ]+\(\d{5}\)))?` +
    String.raw`(?:\s*Boarding Station:\s*(?<boardName>[^()]+?)\s*\((?<board>[A-Z]{1,5})\))?`,
  "g"
);

// IRCTC omits the year. Pick the year that puts the date closest to "today",
// so Jan dates seen in Nov/Dec roll into next year.
export function resolveDate(dm, now = Date.now()) {
  const m = String(dm).trim().match(/^(\d{1,2})\s+([A-Za-z]{3})$/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (month == null) return null;
  const year = new Date(now).getUTCFullYear();
  const best = [year - 1, year, year + 1]
    .map((y) => Date.UTC(y, month, Number(m[1])))
    .sort((a, b) => Math.abs(a - now) - Math.abs(b - now))[0];
  return new Date(best).toISOString().slice(0, 10);
}

const titleCase = (s) => s.trim().replace(/\s+/g, " ");

export function parseIrctcHistory(text, now = Date.now()) {
  const tickets = [];
  for (const m of String(text).matchAll(TICKET)) {
    const g = m.groups;
    const journeyDate = resolveDate(g.d1, now);
    let arrivalDate = resolveDate(g.d2, now);
    // Arrival can't be before departure (e.g. 31 Dec → 01 Jan).
    if (journeyDate && arrivalDate && arrivalDate < journeyDate) {
      arrivalDate = `${Number(arrivalDate.slice(0, 4)) + 1}${arrivalDate.slice(4)}`;
    }
    tickets.push({
      pnr: g.pnr,
      trainNo: g.trainNo,
      trainName: titleCase(g.train),
      depTime: g.dep,
      arrTime: g.arr,
      duration: g.dur.replace(/\s+/g, " "),
      from: g.from,
      fromName: titleCase(g.fromName),
      to: g.to,
      toName: titleCase(g.toName),
      journeyDate,
      arrivalDate,
      bookingStatus: g.status ? g.status.trim() : null,
      boarding: g.board || null,
      boardingName: g.boardName ? titleCase(g.boardName) : null,
    });
  }
  return tickets;
}
