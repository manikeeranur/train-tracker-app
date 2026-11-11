"use client";

import { useEffect, useRef, useState } from "react";
import { SEAT_NAMES, placeSeat, seatLayoutFor } from "@/lib/berth";

// Scene units are px. x runs along the coach, y across it (window wall at y = 0), z is height.
const RP = 64; // row pitch
const SEAT = 36; // seat width (y)
const DEPTH = 34; // seat depth (x)
const GAP = 4;
const AISLE = 34;
const EDGE = 10;
const SEAT_Z = 18;
const BACK_H = 30;
const WALL_H = 96;
const END = 70; // door / vestibule at each end

const TONES = {
  CNF: { top: "linear-gradient(135deg,#19b386,#0b7a5c)", back: "#0a6a50", glow: "rgba(11,122,92,.6)", ink: "#fff" },
  RAC: { top: "linear-gradient(135deg,#ffd23f,#f5b800)", back: "#d29e00", glow: "rgba(245,184,0,.6)", ink: "#3d2c00" },
};

function Face({ style, className = "", children }) {
  return (
    <div className={`absolute ${className}`} style={{ transformOrigin: "0 0", ...style }}>
      {children}
    </div>
  );
}

function Chair({ x, y, facesForward, number, type, mine }) {
  const t = mine ? TONES[mine.status] || TONES.CNF : null;
  // Backrest stands at the rear edge of the cushion (rear = behind the passenger).
  const backX = facesForward ? x : x + DEPTH;
  return (
    <>
      <Face
        style={{
          left: x,
          top: y,
          width: DEPTH,
          height: SEAT,
          transform: `translateZ(${SEAT_Z}px)`,
          background: t ? t.top : "#ffffff",
          borderRadius: 6,
          boxShadow: t ? `0 0 22px 5px ${t.glow}` : "inset 0 0 0 1px #dfe4ee",
        }}
        className="grid place-items-center"
      >
        <div className="text-center leading-none" style={{ color: t ? t.ink : "#5d6474" }}>
          <div className={`font-bold tabular-nums ${mine ? "text-[12px]" : "text-[10px]"}`}>{mine ? mine.label : number}</div>
          <div className="mt-0.5 text-[7px] font-semibold uppercase opacity-80">{mine ? `${number} ${type}` : type}</div>
        </div>
      </Face>
      <Face
        style={{
          left: backX,
          top: y,
          width: BACK_H,
          height: SEAT,
          transform: `translateZ(${SEAT_Z}px) rotateY(-90deg)`,
          background: t ? t.back : "#c9d1df",
          borderRadius: 6,
          opacity: t ? 1 : 0.9,
        }}
      />
    </>
  );
}

/**
 * Walk-through 3D view of a chair-car coach (2S / CC / EC) with the given seats highlighted.
 * seats: [{ label, berth: seatNumber, status }], all in this coach.
 */
export default function SeatView3D({ cls, coach, seats }) {
  const places = seats.map((s) => ({ ...s, place: placeSeat(cls, s.berth) })).filter((s) => s.place);
  const home = places[0]?.place.row ?? 1;
  const [rot, setRot] = useState({ x: 54, z: -28 });
  const [focus, setFocus] = useState(home);
  const [overview, setOverview] = useState(false);
  const touched = useRef(false);
  const drag = useRef(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf;
    const t0 = performance.now();
    const loop = (t) => {
      if (touched.current) return;
      setRot((r) => ({ ...r, z: -28 + 12 * Math.sin((t - t0) / 1800) }));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const L = seatLayoutFor(cls);
  if (!L) return null;
  const rows = Math.max(Math.ceil(L.seats / L.perRow), ...places.map((s) => s.place.rows));
  const D = EDGE * 2 + L.perRow * SEAT + (L.perRow - 1) * GAP + AISLE;
  const seatY = (pos) => EDGE + pos * (SEAT + GAP) + (pos >= L.split ? AISLE - GAP : 0);
  const aisleY = seatY(L.split - 1) + SEAT;
  const total = END * 2 + rows * RP;
  const rowX = (r) => END + (r - 1) * RP;
  const mine = new Map(places.map((s) => [s.berth, s]));
  const myRows = new Set(places.map((s) => s.place.row));
  // 2S rows face each other in pairs; chair cars all face the direction of travel.
  const forward = (r) => (L.facing ? r % 2 === 1 : true);

  const onDown = (e) => {
    touched.current = true;
    drag.current = { px: e.clientX, py: e.clientY, ...rot };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    setRot({ z: d.z + (e.clientX - d.px) * 0.5, x: Math.max(20, Math.min(80, d.x - (e.clientY - d.py) * 0.4)) });
  };
  const onUp = () => (drag.current = null);
  const go = (r) => {
    touched.current = true;
    setOverview(false);
    setFocus(Math.max(1, Math.min(rows, r)));
  };
  const scale = overview ? Math.min(1, 400 / total) : 1;
  const centre = overview ? total / 2 : rowX(focus) + RP / 2;

  const names = places.length ? places.map((s) => `${s.label} · ${s.berth} ${SEAT_NAMES[s.place.type]}`).join("   ") : "No one from your ticket here";
  const btn = "grid size-8 place-items-center rounded-full bg-surface text-sm font-semibold text-ink shadow-sm ring-1 ring-line disabled:opacity-40";

  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-[#eef3fb] to-surface">
      <figcaption className="relative z-10 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 pt-3">
        <p className="text-sm font-semibold">
          Coach <span className="font-mono">{coach}</span>
          <span className="font-normal text-muted"> · {rows} rows · {cls}</span>
        </p>
        <p className="text-xs font-medium text-accent">{names}</p>
      </figcaption>

      <div
        className="relative h-72 cursor-grab touch-none select-none active:cursor-grabbing sm:h-80"
        style={{ perspective: 900 }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="img"
        aria-label={`3D view of coach ${coach}: ${names}`}
      >
        <div
          className="absolute top-[58%] left-1/2"
          style={{ transformStyle: "preserve-3d", transform: `scale(${scale}) rotateX(${rot.x}deg) rotateZ(${rot.z}deg)`, transition: "transform .7s cubic-bezier(.2,.7,.2,1)" }}
        >
          <div
            className="absolute"
            style={{ width: total, height: D, left: 0, top: -D / 2, transformStyle: "preserve-3d", transform: `translateX(${-centre}px)`, transition: "transform .7s cubic-bezier(.2,.7,.2,1)" }}
          >
            <Face style={{ left: 0, top: 0, width: total, height: D, background: "#dfe4ee", borderRadius: 12 }} />
            <Face style={{ left: 0, top: aisleY + GAP, width: total, height: AISLE - GAP * 2, background: "repeating-linear-gradient(90deg,#cfd6e3 0 10px,#d8deea 10px 20px)" }} />
            {/* window wall */}
            <Face style={{ left: 0, top: 0, width: total, height: WALL_H, transform: "rotateX(90deg)", background: "linear-gradient(#e8edf6,#c9d3e4)", opacity: 0.9 }}>
              {Array.from({ length: rows }, (_, i) => (
                <span key={i} className="absolute rounded-md" style={{ left: rowX(i + 1) + 10, top: 22, width: RP - 20, height: 34, background: "linear-gradient(160deg,#bfe3ff,#e9f6ff)", boxShadow: "inset 0 0 0 3px #a9b7cc" }} />
              ))}
            </Face>
            {[0, total].map((px) => (
              <Face key={px} style={{ left: px, top: 0, width: WALL_H, height: D, transform: "rotateY(-90deg)", background: "#c3cddd", opacity: 0.8 }} />
            ))}
            {[0, total - END].map((px, i) => (
              <Face key={`v${px}`} style={{ left: px + 8, top: 20, width: END - 16, height: D - 40, background: "#e9edf4", borderRadius: 8 }} className="grid place-items-center">
                <span className="text-[9px] font-bold tracking-wider text-muted" style={{ writingMode: "vertical-rl", transform: i ? "none" : "rotate(180deg)" }}>
                  DOOR · WASHROOM
                </span>
              </Face>
            ))}
            {Array.from({ length: rows }, (_, i) => (
              <Face key={`l${i}`} style={{ left: rowX(i + 1), top: aisleY + GAP, width: RP, height: AISLE - GAP * 2 }} className="grid place-items-center">
                <span className={`text-[8px] font-bold ${myRows.has(i + 1) ? "text-accent" : "text-muted"}`}>ROW {i + 1}</span>
              </Face>
            ))}
            {Array.from({ length: rows }, (_, i) => {
              const r = i + 1;
              return Array.from({ length: L.perRow }, (_, pos) => {
                const number = i * L.perRow + pos + 1;
                return (
                  <Chair
                    key={number}
                    x={rowX(r) + (RP - DEPTH) / 2}
                    y={seatY(pos)}
                    facesForward={forward(r)}
                    number={number}
                    type={L.pattern[pos]}
                    mine={mine.get(number)}
                  />
                );
              });
            })}
          </div>
        </div>
        <p className="pointer-events-none absolute right-3 bottom-2 text-[10px] text-muted">Drag to rotate</p>
      </div>

      <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
        <button className={btn} onClick={() => go(focus - 2)} disabled={focus <= 1} aria-label="Previous rows">◀</button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-px" aria-hidden>
            {Array.from({ length: rows }, (_, i) => (
              <button
                key={i}
                tabIndex={-1}
                onClick={() => go(i + 1)}
                className={`h-3 flex-1 rounded-[2px] ${myRows.has(i + 1) ? "bg-accent" : i + 1 === focus ? "bg-ink/40" : "bg-surface-2"}`}
              />
            ))}
          </div>
          <p className="mt-1 truncate text-center text-[11px] text-muted">
            {overview ? `Whole coach · ${rows} rows · door to door` : `Viewing row ${focus} of ${rows} · seats ${(focus - 1) * L.perRow + 1}–${focus * L.perRow}`}
          </p>
        </div>
        <button className={btn} onClick={() => go(focus + 2)} disabled={focus >= rows} aria-label="Next rows">▶</button>
        {focus !== home || overview ? (
          <button onClick={() => go(home)} className="rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-ink">My seat</button>
        ) : (
          <button
            onClick={() => {
              touched.current = true;
              setOverview(true);
              setRot({ x: 38, z: -6 });
            }}
            className="rounded-full bg-surface px-3 py-1.5 text-[11px] font-semibold text-ink ring-1 ring-line"
          >
            Whole coach
          </button>
        )}
      </div>
    </figure>
  );
}
