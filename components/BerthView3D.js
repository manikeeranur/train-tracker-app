"use client";

import { useEffect, useRef, useState } from "react";
import { BERTH_NAMES, placeBerth } from "@/lib/berth";

// Scene units are px. x runs along the coach, y across it (window wall at y = 0), z is height.
const W = 240; // bay length
const D = 170; // coach width
const T = 7; // berth thickness
const WALL_H = 116;
const END = 70; // door / washroom vestibule at each end of the coach

// Berth boxes per bay slot: [x, y, width(x), depth(y), z], relative to the bay.
const STACK_A = 6;
const STACK_B = W - 58;
const MAIN_D = 112;
const SIDE = [30, 134, 180, 36];
function slots(bay) {
  if (bay === 8)
    return [
      [STACK_A, 0, 52, MAIN_D, 18], [STACK_A, 0, 52, MAIN_D, 58], [STACK_A, 0, 52, MAIN_D, 98],
      [STACK_B, 0, 52, MAIN_D, 18], [STACK_B, 0, 52, MAIN_D, 58], [STACK_B, 0, 52, MAIN_D, 98],
      [...SIDE, 18], [...SIDE, 82],
    ];
  if (bay === 6)
    return [
      [STACK_A, 0, 52, MAIN_D, 22], [STACK_A, 0, 52, MAIN_D, 86],
      [STACK_B, 0, 52, MAIN_D, 22], [STACK_B, 0, 52, MAIN_D, 86],
      [...SIDE, 22], [...SIDE, 86],
    ];
  return [
    [STACK_A, 0, 52, MAIN_D, 22], [STACK_A, 0, 52, MAIN_D, 86],
    [STACK_B, 0, 52, MAIN_D, 22], [STACK_B, 0, 52, MAIN_D, 86],
  ];
}

const TONES = {
  CNF: { top: "linear-gradient(135deg,#19b386,#0b7a5c)", edge: "#085c45", glow: "rgba(11,122,92,.55)", ink: "#fff" },
  RAC: { top: "linear-gradient(135deg,#ffd23f,#f5b800)", edge: "#b88a00", glow: "rgba(245,184,0,.6)", ink: "#3d2c00" },
};

function Face({ style, className = "", children }) {
  return (
    <div className={`absolute ${className}`} style={{ transformOrigin: "0 0", ...style }}>
      {children}
    </div>
  );
}

/** One berth: top face plus the edge facing the open space (so it reads as a solid bunk). */
function Bunk({ box, ox, side, number, type, mine, fade }) {
  const [bx, y, w, d, z] = box;
  const x = bx + ox;
  const t = mine ? TONES[mine.status] || TONES.CNF : null;
  const edgeFace =
    side === "a"
      ? { left: x + w, top: y, width: T, height: d, transform: `translateZ(${z}px) rotateY(90deg)` }
      : side === "b"
        ? { left: x, top: y, width: T, height: d, transform: `translateZ(${z}px) rotateY(90deg)` }
        : { left: x, top: y, width: w, height: T, transform: `translateZ(${z}px) rotateX(-90deg)` };
  const opacity = mine ? 1 : fade;
  return (
    <>
      <Face style={{ ...edgeFace, background: t ? t.edge : "#cfd5e1", opacity }} />
      <Face
        style={{
          left: x,
          top: y,
          width: w,
          height: d,
          transform: `translateZ(${z}px)`,
          background: t ? t.top : "#ffffff",
          borderRadius: 6,
          boxShadow: t ? `0 0 26px 6px ${t.glow}` : "inset 0 0 0 1px #e3e6ee",
          opacity,
        }}
        className="grid place-items-center"
      >
        <div className="text-center leading-tight" style={{ color: t ? t.ink : "#5d6474" }}>
          <div className={`font-bold tabular-nums ${mine ? "text-[15px]" : "text-[12px]"}`}>{mine ? mine.label : number}</div>
          <div className="text-[8px] font-semibold tracking-wide uppercase opacity-80">{mine ? `${number} ${type}` : type}</div>
        </div>
      </Face>
    </>
  );
}

/**
 * Walk-through 3D view of a whole coach (door to door) with the given passengers' berths
 * highlighted. seats: [{ label, berth, type?, status: "CNF" | "RAC" }], all in this coach.
 */
export default function BerthView3D({ cls, coach, seats }) {
  const places = seats.map((s) => ({ ...s, place: placeBerth(cls, s.berth, s.type) })).filter((s) => s.place);
  const home = places[0]?.place.bay ?? 1;
  const [rot, setRot] = useState({ x: 56, z: -30 });
  const [focus, setFocus] = useState(home);
  const [overview, setOverview] = useState(false);
  const touched = useRef(false);
  const drag = useRef(null);

  // Gentle idle sway until the user grabs the view.
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf;
    const t0 = performance.now();
    const loop = (t) => {
      if (touched.current) return;
      setRot((r) => ({ ...r, z: -30 + 12 * Math.sin((t - t0) / 1800) }));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!places.length) return null;
  const L = places[0].place.layout;
  const bays = Math.max(...places.map((s) => s.place.bays));
  const boxes = slots(L.bay);
  const sideFrom = L.bay === 4 ? 4 : L.bay - 2;
  const mineByBerth = new Map(places.map((s) => [s.berth, s]));
  const total = END * 2 + bays * W;
  const bayX = (b) => END + (b - 1) * W; // left edge of bay b
  const myBays = new Set(places.map((s) => s.place.bay));

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
  const go = (b) => {
    touched.current = true;
    setOverview(false);
    setFocus(Math.max(1, Math.min(bays, b)));
  };
  // Whole-coach view: zoom out around the coach's middle.
  const scale = overview ? Math.min(1, 400 / total) : 1;
  const centre = overview ? total / 2 : bayX(focus) + W / 2;

  const names = places.map((s) => `${s.label} · ${s.berth} ${BERTH_NAMES[s.place.type]}`).join("   ");
  const lowestMine = {};
  for (const s of places) {
    const z = boxes[s.place.slot][4];
    lowestMine[s.place.bay] = Math.min(lowestMine[s.place.bay] ?? Infinity, z);
  }
  const btn = "grid size-8 place-items-center rounded-full bg-surface text-sm font-semibold text-ink shadow-sm ring-1 ring-line disabled:opacity-40";

  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-[#eef3fb] to-surface">
      <figcaption className="relative z-10 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 pt-3">
        <p className="text-sm font-semibold">
          Coach <span className="font-mono">{coach}</span>
          <span className="font-normal text-muted"> · {bays} bays · {cls}</span>
        </p>
        <p className="text-xs font-medium text-accent">{names}</p>
      </figcaption>

      {/* 3D coach */}
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
        {/* Pivot sits at the focused bay's centre, so rotation and walking are around it. */}
        <div className="absolute top-[58%] left-1/2" style={{ transformStyle: "preserve-3d", transform: `scale(${scale}) rotateX(${rot.x}deg) rotateZ(${rot.z}deg)`, transition: "transform .7s cubic-bezier(.2,.7,.2,1)" }}>
          <div
            className="absolute"
            style={{
              width: total,
              height: D,
              left: 0,
              top: -D / 2,
              transformStyle: "preserve-3d",
              transform: `translateX(${-centre}px)`,
              transition: "transform .7s cubic-bezier(.2,.7,.2,1)",
            }}
          >
            {/* floor + aisle */}
            <Face style={{ left: 0, top: 0, width: total, height: D, background: "#dfe4ee", borderRadius: 12 }} />
            <Face style={{ left: 0, top: MAIN_D + 4, width: total, height: 18, background: "repeating-linear-gradient(90deg,#cfd6e3 0 10px,#d8deea 10px 20px)" }} />
            {/* window wall along the whole coach */}
            <Face style={{ left: 0, top: 0, width: total, height: WALL_H, transform: "rotateX(90deg)", background: "linear-gradient(#e8edf6,#c9d3e4)", opacity: 0.9 }}>
              {Array.from({ length: bays }, (_, i) =>
                [40, 150].map((wx) => (
                  <span
                    key={`${i}-${wx}`}
                    className="absolute rounded-md"
                    style={{ left: bayX(i + 1) + wx, top: 26, width: 52, height: 40, background: "linear-gradient(160deg,#bfe3ff,#e9f6ff)", boxShadow: "inset 0 0 0 3px #a9b7cc" }}
                  />
                ))
              )}
            </Face>
            {/* ends: door + washroom */}
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
            {/* bay partitions + floor labels */}
            {Array.from({ length: bays + 1 }, (_, i) => (
              <Face key={`p${i}`} style={{ left: bayX(i + 1), top: 0, width: WALL_H, height: MAIN_D, transform: "rotateY(-90deg)", background: "#d3dbe8", opacity: 0.3 }} />
            ))}
            {Array.from({ length: bays }, (_, i) => (
              <Face key={`l${i}`} style={{ left: bayX(i + 1) + 90, top: MAIN_D + 4, width: 60, height: 18 }} className="grid place-items-center">
                <span className={`text-[9px] font-bold ${myBays.has(i + 1) ? "text-accent" : "text-muted"}`}>BAY {i + 1}</span>
              </Face>
            ))}
            {/* berths */}
            {Array.from({ length: bays }, (_, i) => {
              const bay = i + 1;
              return boxes.map((box, slot) => {
                const number = i * L.bay + slot + 1;
                const isSide = slot >= sideFrom;
                // Side berths (nearest the viewer) and anything stacked above your berth fade, so yours stays visible.
                const fade = isSide || (lowestMine[bay] != null && box[4] > lowestMine[bay]) ? 0.45 : 1;
                return (
                  <Bunk
                    key={number}
                    box={box}
                    ox={bayX(bay)}
                    side={isSide ? "s" : box[0] === STACK_A ? "a" : "b"}
                    number={number}
                    type={L.pattern[slot]}
                    mine={mineByBerth.get(number)}
                    fade={fade}
                  />
                );
              });
            })}
          </div>
        </div>
        <p className="pointer-events-none absolute right-3 bottom-2 text-[10px] text-muted">Drag to rotate</p>
      </div>

      {/* Walk through the coach */}
      <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
        <button className={btn} onClick={() => go(focus - 1)} disabled={focus <= 1} aria-label="Previous bay">◀</button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-0.5" aria-hidden>
            {Array.from({ length: bays }, (_, i) => (
              <button
                key={i}
                tabIndex={-1}
                onClick={() => go(i + 1)}
                className={`h-3 flex-1 rounded-sm transition ${myBays.has(i + 1) ? "bg-accent" : i + 1 === focus ? "bg-ink/40" : "bg-surface-2"} ${i + 1 === focus ? "ring-2 ring-ink/50" : ""}`}
              />
            ))}
          </div>
          <p className="mt-1 truncate text-center text-[11px] text-muted">
            {overview ? (
              `Whole coach · ${bays} bays · door to door`
            ) : (
              <>
                Viewing bay {focus} of {bays} · berths {(focus - 1) * L.bay + 1}–{focus * L.bay}
                {(focus === 1 || focus === bays) && " · near door"}
              </>
            )}
          </p>
        </div>
        <button className={btn} onClick={() => go(focus + 1)} disabled={focus >= bays} aria-label="Next bay">▶</button>
        {focus !== home || overview ? (
          <button onClick={() => go(home)} className="rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-ink">My berth</button>
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
