import CoachPicker from "./CoachPicker";
import { layoutFor, parseSeat, placeBerth, placeSeat, seatLayoutFor } from "@/lib/berth";

/** True when this class has a 3D coach view (sleeper/AC berths or chair-car seats). */
export const has3D = (cls) => Boolean(layoutFor(cls) || seatLayoutFor(cls));

/**
 * "Your berth / seat" section for a tracked PNR: one walk-through 3D coach per coach, with
 * every passenger in it highlighted. Renders nothing when no berth or seat is allotted yet.
 */
export default function MyBerths({ cls, passengers, names = {}, heading = true, fill = false }) {
  const berths = Boolean(layoutFor(cls));
  if (!berths && !seatLayoutFor(cls)) return null;
  const groups = new Map();
  for (const p of passengers) {
    const seat = parseSeat(p.current) || parseSeat(p.booking);
    if (!seat) continue;
    if (berths ? !placeBerth(cls, seat.berth, seat.type) : !placeSeat(cls, seat.berth)) continue;
    // One 3D coach per coach number; everyone in it is highlighted.
    if (!groups.has(seat.coach)) groups.set(seat.coach, { coach: seat.coach, seats: [] });
    groups.get(seat.coach).seats.push({ label: names[p.n] || `P${p.n}`, berth: seat.berth, type: seat.type, status: seat.status });
  }
  if (!groups.size) return null;
  const noun = berths ? "berth" : "seat";
  return (
    <section id="berth" className={`scroll-mt-20 space-y-3 ${fill ? "flex min-h-0 flex-1 flex-col" : ""}`}>
      {heading && <h2 className="font-semibold tracking-tight">Your {noun}{passengers.length > 1 ? "s" : ""}</h2>}
      <CoachPicker cls={cls} groups={[...groups.values()]} fill={fill} />
    </section>
  );
}
