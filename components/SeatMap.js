"use client";

import { useEffect, useRef } from "react";
import { BERTH_NAMES, SEAT_NAMES, layoutFor, placeBerth, placeSeat, seatLayoutFor } from "@/lib/berth";

const SHORT = { LB: "Lower", MB: "Middle", UB: "Upper", SL: "S.Lower", SU: "S.Upper", W: "Window", M: "Middle", A: "Aisle" };

/** One berth/seat tile. Labels sit above the number on one row and below on the next, like a real coach chart. */
function Tile({ n, type, mine, labelTop, compact }) {
  const tone = mine ? (mine.status === "RAC" ? "bg-rac-bar text-ink ring-2 ring-rac" : "bg-accent text-accent-ink ring-2 ring-accent") : "bg-surface text-ink ring-1 ring-line";
  const lbl = <span className={`block text-[9px] font-semibold tracking-wide uppercase ${mine ? "opacity-90" : "text-muted"}`}>{mine ? mine.label : SHORT[type]}</span>;
  return (
    <div
      data-mine={mine ? "1" : undefined}
      className={`grid place-items-center rounded-lg px-1 text-center leading-tight ${compact ? "py-1.5" : "py-2"} ${tone}`}
      title={`${n} · ${BERTH_NAMES[type] || SEAT_NAMES[type] || type}`}
    >
      <div>
        {labelTop && lbl}
        <span className={`block font-bold tabular-nums ${compact ? "text-base" : "text-lg"}`}>{n}</span>
        {!labelTop && lbl}
      </div>
    </div>
  );
}

/** 2D coach chart: every bay (or seat row) of one coach, your berths/seats highlighted. */
export default function SeatMap({ cls, coach, seats, fill = false }) {
  const ref = useRef(null);
  const mine = new Map(seats.map((s) => [s.berth, s]));
  const BL = layoutFor(cls);
  const SL = seatLayoutFor(cls);

  // Bring your berth into view when the map opens (scrolls only the map, after the sheet has opened).
  useEffect(() => {
    const t = setTimeout(() => {
      const box = ref.current;
      const el = box?.querySelector("[data-mine]");
      if (!box || !el) return;
      const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
      box.scrollTo({ top: top - box.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
    }, 250);
    return () => clearTimeout(t);
  }, [coach]);

  if (BL) {
    const bays = Math.max(Math.ceil(BL.berths / BL.bay), ...seats.map((s) => placeBerth(cls, s.berth, s.type)?.bays || 0));
    const per = BL.bay === 8 ? 3 : 2; // berths per main row
    const hasSide = BL.bay !== 4;
    return (
      <div ref={ref} className={`overflow-y-auto rounded-2xl bg-surface-2 p-2.5 ${fill ? "min-h-0 flex-1" : "max-h-[60dvh]"}`}>
        <p className="mb-2 text-center text-[10px] font-semibold tracking-widest text-muted">⇡ DOOR · WASHROOM</p>
        <div className="space-y-2">
          {Array.from({ length: bays }, (_, b) => {
            const first = b * BL.bay + 1;
            const rowA = Array.from({ length: per }, (_, i) => first + i);
            const rowB = Array.from({ length: per }, (_, i) => first + per + i);
            const sideL = first + per * 2;
            const sideU = sideL + 1;
            const t = (n) => BL.pattern[n - first];
            return (
              <div key={b} className="grid grid-cols-[1fr_auto] gap-x-6">
                <div className="space-y-1 rounded-xl border border-line bg-surface-2 p-1">
                  <div className={`grid gap-1 ${per === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                    {rowA.map((n) => <Tile key={n} n={n} type={t(n)} mine={mine.get(n)} />)}
                  </div>
                  <div className={`grid gap-1 ${per === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                    {rowB.map((n) => <Tile key={n} n={n} type={t(n)} mine={mine.get(n)} labelTop />)}
                  </div>
                </div>
                {hasSide && (
                  <div className="flex w-[4.5rem] flex-col justify-between gap-1 rounded-xl border border-line p-1">
                    <Tile n={sideL} type="SL" mine={mine.get(sideL)} />
                    <Tile n={sideU} type="SU" mine={mine.get(sideU)} labelTop />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[10px] font-semibold tracking-widest text-muted">DOOR · WASHROOM ⇣</p>
      </div>
    );
  }

  if (SL) {
    const rows = Math.max(Math.ceil(SL.seats / SL.perRow), ...seats.map((s) => placeSeat(cls, s.berth)?.rows || 0));
    return (
      <div ref={ref} className={`overflow-y-auto rounded-2xl bg-surface-2 p-2.5 ${fill ? "min-h-0 flex-1" : "max-h-[60dvh]"}`}>
        <p className="mb-2 text-center text-[10px] font-semibold tracking-widest text-muted">⇡ DOOR</p>
        <div className="space-y-1">
          {Array.from({ length: rows }, (_, r) => {
            const first = r * SL.perRow + 1;
            const nums = Array.from({ length: SL.perRow }, (_, i) => first + i);
            return (
              <div key={r} className="flex items-center gap-1">
                <span className="w-6 shrink-0 text-right text-[9px] text-muted tabular-nums">{r + 1}</span>
                <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${SL.split}, 1fr) 1.25rem repeat(${SL.perRow - SL.split}, 1fr)` }}>
                  {nums.slice(0, SL.split).map((n, i) => <Tile key={n} n={n} type={SL.pattern[i]} mine={mine.get(n)} compact />)}
                  <span aria-hidden />
                  {nums.slice(SL.split).map((n, i) => <Tile key={n} n={n} type={SL.pattern[SL.split + i]} mine={mine.get(n)} compact />)}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[10px] font-semibold tracking-widest text-muted">DOOR ⇣</p>
      </div>
    );
  }
  return null;
}
