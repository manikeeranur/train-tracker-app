import BerthView3D from "./BerthView3D";
import { layoutFor, parseSeat, placeBerth } from "@/lib/berth";

/**
 * "Your berth" section for a tracked PNR: one walk-through 3D coach per coach, with
 * every passenger seated in it highlighted. Renders nothing when no berth is allotted yet.
 */
export default function MyBerths({ cls, passengers, names = {}, heading = true }) {
  if (!layoutFor(cls)) return null;
  const groups = new Map();
  for (const p of passengers) {
    const seat = parseSeat(p.current) || parseSeat(p.booking);
    if (!seat) continue;
    if (!placeBerth(cls, seat.berth, seat.type)) continue;
    // One 3D coach per coach number; everyone in it is highlighted.
    if (!groups.has(seat.coach)) groups.set(seat.coach, { coach: seat.coach, seats: [] });
    groups.get(seat.coach).seats.push({ label: names[p.n] || `P${p.n}`, berth: seat.berth, type: seat.type, status: seat.status });
  }
  if (!groups.size) return null;
  return (
    <section id="berth" className="scroll-mt-20 space-y-3">
      {heading && <h2 className="font-semibold tracking-tight">Your berth{passengers.length > 1 ? "s" : ""}</h2>}
      {[...groups.values()].map((g) => (
        <BerthView3D key={g.coach} cls={cls} coach={g.coach} seats={g.seats} />
      ))}
    </section>
  );
}
