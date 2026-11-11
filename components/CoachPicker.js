"use client";

import { useState } from "react";
import BerthView3D from "./BerthView3D";
import CoachWalk3D from "./CoachWalk3D";
import SeatMap from "./SeatMap";
import SeatView3D from "./SeatView3D";
import { coachesOf, layoutFor } from "@/lib/berth";

/**
 * Strip of every coach of your class (S1…S10). Tap one to see it as a 2D seat map, top 3D view
 * or walk inside it; coaches you're in
 * are green and show your berths/seats highlighted.
 */
export default function CoachPicker({ cls, groups }) {
  const mine = groups.map((g) => g.coach);
  const coaches = coachesOf(cls, mine);
  const [sel, setSel] = useState(mine[0]);
  const [mode, setMode] = useState("top");
  const View = layoutFor(cls) ? BerthView3D : SeatView3D;
  const seats = groups.find((g) => g.coach === sel)?.seats ?? [];

  return (
    <div className="space-y-2">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Coaches">
        {coaches.map((c) => {
          const isMine = mine.includes(c);
          const active = c === sel;
          return (
            <button
              key={c}
              role="tab"
              aria-selected={active}
              onClick={() => setSel(c)}
              className={`relative shrink-0 rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition ${
                active ? (isMine ? "bg-accent text-accent-ink" : "bg-ink text-white") : isMine ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              {c}
              {isMine && !active && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent ring-2 ring-surface" />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted">Typical {coaches[0]}–{coaches.at(-1)}; the real train may differ.</p>
        <div className="inline-flex shrink-0 rounded-lg bg-surface-2 p-0.5 text-[11px] font-medium" role="group" aria-label="View">
          {[["top", "Top view"], ["map", "2D"], ["inside", "Walk inside"]].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={`rounded-md px-2.5 py-1 transition ${mode === k ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      {mode === "map" && <SeatMap key={sel} cls={cls} coach={sel} seats={seats} />}
      {mode === "top" && <View key={sel} cls={cls} coach={sel} seats={seats} />}
      {mode === "inside" && <CoachWalk3D key={sel} cls={cls} coach={sel} seats={seats} />}
    </div>
  );
}
