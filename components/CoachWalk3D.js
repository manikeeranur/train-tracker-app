"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BERTH_NAMES, SEAT_NAMES, layoutFor, placeBerth, placeSeat, seatLayoutFor } from "@/lib/berth";

// Walk-through, first-person view inside a coach (WebGL via three.js, loaded on demand).
// Units are metres. x runs along the coach, z across it (window wall behind the main berths
// at z = 0, side berths at z ≈ 3), y is up. Empty coach: only your berths/seats are marked.

const WIDTH = 3.0;
const HEIGHT = 2.6;
const EYE = 1.6;
const END = 1.6; // vestibule length at each end (door + washroom)
const WALK = 1.8; // m/s
const TURN = 1.6; // rad/s

export default function CoachWalk3D({ cls, coach, seats, fill = false }) {
  // Rebuild the scene only when the seats actually change, not on every new array.
  const seatKey = JSON.stringify(seats);
  const host = useRef(null);
  const api = useRef({});
  const [state, setState] = useState("loading"); // loading | ready | nogl
  const [hint, setHint] = useState("");

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import("three");
      if (disposed || !host.current) return;
      const el = host.current;
      const seatList = JSON.parse(seatKey);
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
      } catch {
        setState("nogl");
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xdfe7f2);
      scene.fog = new THREE.Fog(0xdfe7f2, 9, 26);
      const camera = new THREE.PerspectiveCamera(80, el.clientWidth / el.clientHeight, 0.05, 60);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.6));
      const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
      sun.position.set(3, 6, -4);
      scene.add(sun);

      const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
      const M = {
        floor: mat(0x9aa3ad),
        aisle: mat(0x7f8892),
        wall: mat(0xeef1f5),
        ceil: mat(0xf7f8fa),
        window: new THREE.MeshStandardMaterial({ color: 0x9fd4ff, emissive: 0x6fb8f0, emissiveIntensity: 0.55, roughness: 0.2 }),
        berth: mat(0x3d5a80),
        berthTop: mat(0x47678f),
        frame: mat(0xb9c2cc, { metalness: 0.4, roughness: 0.4 }),
        mine: new THREE.MeshStandardMaterial({ color: 0x19b386, emissive: 0x0b7a5c, emissiveIntensity: 0.7 }),
        rac: new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xb88a00, emissiveIntensity: 0.6 }),
        door: mat(0x8f9aa6, { metalness: 0.3, roughness: 0.5 }),
        light: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 }),
        seat: mat(0x2f6f8f),
      };
      const box = (w, h, d, m, x, y, z) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        return mesh;
      };

      // Floating label over your berth / seat.
      const label = (text, sub, color) => {
        const c = document.createElement("canvas");
        c.width = 512;
        c.height = 200;
        const g = c.getContext("2d");
        g.fillStyle = color;
        g.beginPath();
        g.roundRect(6, 6, 500, 188, 40);
        g.fill();
        g.fillStyle = "#fff";
        g.textAlign = "center";
        g.font = "bold 84px system-ui, sans-serif";
        g.fillText(text, 256, 100);
        g.font = "600 52px system-ui, sans-serif";
        g.fillText(sub, 256, 166);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
        sp.scale.set(0.42, 0.16, 1);
        sp.renderOrder = 10;
        scene.add(sp);
        return sp;
      };
      // Small number plate on each berth / seat.
      const plate = (text, x, y, z) => {
        const c = document.createElement("canvas");
        c.width = 128;
        c.height = 64;
        const g = c.getContext("2d");
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, 128, 64);
        g.fillStyle = "#1f2937";
        g.textAlign = "center";
        g.font = "bold 40px system-ui, sans-serif";
        g.fillText(text, 64, 46);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }));
        sp.scale.set(0.13, 0.065, 1);
        sp.position.set(x, y, z);
        scene.add(sp);
      };

      // ---- coach shell ----
      const BL = layoutFor(cls);
      const SL = seatLayoutFor(cls);
      const unitLen = BL ? 2.0 : 0.95; // bay length or seat-row pitch
      const units = BL
        ? Math.max(Math.ceil(BL.berths / BL.bay), ...seatList.map((s) => placeBerth(cls, s.berth, s.type)?.bays || 0))
        : Math.max(Math.ceil(SL.seats / SL.perRow), ...seatList.map((s) => placeSeat(cls, s.berth)?.rows || 0));
      const LEN = END * 2 + units * unitLen;
      // Fit every seat of the row (2S 3+3, CC 3+2, EC 2+2) between the walls, with a 0.55 m aisle.
      const AISLE_W = 0.55;
      const seatW = SL ? Math.min(0.5, (WIDTH - 0.2 - AISLE_W) / SL.perRow) : 0.5;
      const zOf = (pos) => 0.1 + seatW / 2 + pos * seatW + (pos >= SL?.split ? AISLE_W : 0);
      const AISLE_Z = BL ? 2.15 : (zOf(SL.split - 1) + zOf(SL.split)) / 2;

      box(LEN, 0.05, WIDTH, M.floor, LEN / 2, -0.025, WIDTH / 2);
      box(LEN, 0.01, 0.55, M.aisle, LEN / 2, 0.005, AISLE_Z);
      box(LEN, 0.05, WIDTH, M.ceil, LEN / 2, HEIGHT, WIDTH / 2);
      for (const wz of [0, WIDTH]) {
        box(LEN, 0.85, 0.06, M.wall, LEN / 2, 0.425, wz);
        box(LEN, 0.85, 0.06, M.wall, LEN / 2, HEIGHT - 0.425, wz);
        for (let i = 0; i < units; i++) {
          const x0 = END + i * unitLen;
          (BL ? [0.55, 1.45] : [unitLen / 2]).forEach((dx) => box(0.85, 0.9, 0.03, M.window, x0 + dx, 1.3, wz));
          box(0.12, 0.9, 0.06, M.wall, x0 + 0.06, 1.3, wz);
        }
      }
      // outer end walls (gangway) closing the vestibules
      for (const ex of [0, LEN]) {
        box(0.06, HEIGHT, WIDTH, M.wall, ex, HEIGHT / 2, WIDTH / 2);
        box(0.07, 2.0, 0.8, M.door, ex, 1.0, AISLE_Z);
      }
      // ceiling light strips
      for (let x = END; x < LEN - END; x += 2) box(1.2, 0.03, 0.12, M.light, x + 0.6, HEIGHT - 0.04, AISLE_Z);

      // end walls with sliding doors (open when you walk up to them)
      const doors = [];
      for (const [ex, dirX] of [[END * 0.5, 1], [LEN - END * 0.5, -1]]) {
        box(0.06, HEIGHT, AISLE_Z - 0.45, M.wall, ex, HEIGHT / 2, (AISLE_Z - 0.45) / 2);
        box(0.06, HEIGHT, WIDTH - AISLE_Z - 0.45, M.wall, ex, HEIGHT / 2, (WIDTH + AISLE_Z + 0.45) / 2);
        box(0.06, HEIGHT - 2.1, 0.9, M.wall, ex, 2.1 + (HEIGHT - 2.1) / 2, AISLE_Z);
        const door = box(0.04, 2.08, 0.88, M.door, ex, 1.04, AISLE_Z);
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.5, 0.4), M.window);
        win.position.set(0, 0.45, 0);
        door.add(win);
        doors.push({ mesh: door, x: ex, closedZ: AISLE_Z });
        // washroom block in the vestibule
        box(END * 0.45, 2.1, 1.0, M.wall, ex - (dirX * END) / 4, 1.05, 0.55);
        plate("WC", ex - (dirX * END) / 4, 1.9, 1.08);
      }

      // ---- berths / seats (empty coach; yours highlighted) ----
      const mine = new Map(seatList.map((s) => [s.berth, s]));
      let home = { x: END + unitLen / 2, yaw: 0, pitch: -0.12 };

      if (BL) {
        const H = BL.bay === 8 ? { LB: 0.45, MB: 1.15, UB: 1.85, SL: 0.45, SU: 1.75 } : { LB: 0.45, UB: 1.6, SL: 0.45, SU: 1.6 };
        for (let b = 0; b < units; b++) {
          const x0 = END + b * unitLen;
          box(0.04, HEIGHT - 0.2, 1.9, M.wall, x0 + 0.02, (HEIGHT - 0.2) / 2, 0.95); // bay partition
          BL.pattern.forEach((type, slot) => {
            const n = b * BL.bay + slot + 1;
            const side = type === "SL" || type === "SU";
            const stackA = !side && slot < (BL.bay === 8 ? 3 : 2);
            const y = H[type];
            const me = mine.get(n);
            const hl = me ? (me.status === "RAC" ? M.rac : M.mine) : null;
            let cx;
            let cz;
            if (side) {
              cx = x0 + unitLen / 2;
              cz = WIDTH - 0.32;
              box(1.8, 0.08, 0.56, hl || M.berth, cx, y, cz);
              if (type === "SL") box(1.8, 0.4, 0.04, M.frame, cx, y - 0.22, cz - 0.27);
            } else {
              cx = stackA ? x0 + 0.38 : x0 + unitLen - 0.38;
              cz = 0.95;
              box(0.62, 0.08, 1.85, hl || M.berth, cx, y, cz);
              if (type === "LB") box(0.62, 0.42, 0.06, M.berthTop, cx, y + 0.25, 0.06); // backrest
            }
            plate(String(n), cx, y + (type === "UB" || type === "SU" ? 0.1 : 0.55), side ? cz - 0.3 : 1.88);
            if (me) {
              const lb = label(me.label, `${n} ${BERTH_NAMES[type]}`, me.status === "RAC" ? "#b88a00" : "#0b7a5c");
              lb.position.set(cx, y + 0.32, side ? cz - 0.2 : 1.75);
              // Face your berth (main berths toward z = 0, side berths toward z = WIDTH); look up/down to it.
              const pitch = { UB: 0.3, SU: 0.25, MB: 0.05, LB: -0.3, SL: -0.3 }[type] ?? 0;
              home = { x: x0 + unitLen / 2, yaw: side ? Math.PI / 2 : -Math.PI / 2, pitch };
            }
          });
        }
      } else {
        for (let row = 0; row < units; row++) {
          const x0 = END + row * unitLen;
          const fwd = SL.facing ? row % 2 === 0 : true;
          for (let pos = 0; pos < SL.perRow; pos++) {
            const n = row * SL.perRow + pos + 1;
            const z = zOf(pos);
            const me = mine.get(n);
            const hl = me ? (me.status === "RAC" ? M.rac : M.mine) : null;
            const sx = x0 + unitLen / 2;
            box(0.46, 0.1, seatW - 0.04, hl || M.seat, sx, 0.45, z);
            box(0.08, 0.6, seatW - 0.04, hl || M.seat, sx + (fwd ? -0.22 : 0.22), 0.8, z);
            plate(String(n), sx + (fwd ? -0.27 : 0.27), 1.18, z);
            if (me) {
              const lb = label(me.label, `${n} ${SEAT_NAMES[SL.pattern[pos]]}`, me.status === "RAC" ? "#b88a00" : "#0b7a5c");
              lb.position.set(sx, 1.4, z);
              home = { x: sx + (fwd ? 0.9 : -0.9), yaw: fwd ? Math.PI : 0, pitch: -0.35 };
            }
          }
        }
      }

      // ---- first-person camera ----
      const cam = { x: home.x, yaw: home.yaw, pitch: home.pitch };
      const input = { fwd: 0, turn: 0 };
      api.current = {
        set: (k, v) => (input[k] = v),
        home: () => Object.assign(cam, { x: home.x, yaw: home.yaw, pitch: home.pitch }),
      };
      let drag = null;
      const canvas = renderer.domElement;
      canvas.style.touchAction = "none";
      const down = (e) => {
        drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch };
        canvas.setPointerCapture?.(e.pointerId);
      };
      const move = (e) => {
        if (!drag) return;
        cam.yaw = drag.yaw + (e.clientX - drag.x) * 0.006;
        cam.pitch = Math.max(-1.1, Math.min(0.9, drag.pitch - (e.clientY - drag.y) * 0.005));
      };
      const up = () => (drag = null);
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);
      const keys = (on) => (e) => {
        const k = e.key.toLowerCase();
        if (["arrowup", "w"].includes(k)) input.fwd = on ? 1 : 0;
        else if (["arrowdown", "s"].includes(k)) input.fwd = on ? -1 : 0;
        else if (["arrowleft", "a"].includes(k)) input.turn = on ? -1 : 0;
        else if (["arrowright", "d"].includes(k)) input.turn = on ? 1 : 0;
        else return;
        e.preventDefault();
      };
      const kd = keys(true);
      const ku = keys(false);
      window.addEventListener("keydown", kd);
      window.addEventListener("keyup", ku);

      const onResize = () => {
        renderer.setSize(el.clientWidth, el.clientHeight);
        camera.aspect = el.clientWidth / el.clientHeight;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(onResize);
      ro.observe(el);

      let last = performance.now();
      let raf;
      let lastHint = "";
      const tick = (t) => {
        const dt = Math.min(0.05, (t - last) / 1000);
        last = t;
        cam.yaw += input.turn * TURN * dt;
        // ▲ walks along the aisle toward whichever end you're facing, at full speed.
        const along = Math.cos(cam.yaw) >= 0 ? 1 : -1;
        cam.x = Math.max(0.3, Math.min(LEN - 0.3, cam.x + input.fwd * WALK * dt * along));
        const camZ = AISLE_Z + (BL ? 0.12 : 0); // a step toward the side berths keeps the bay in view
        camera.position.set(cam.x, EYE, camZ);
        camera.lookAt(cam.x + Math.cos(cam.yaw) * Math.cos(cam.pitch), EYE + Math.sin(cam.pitch), camZ + Math.sin(cam.yaw) * Math.cos(cam.pitch));
        // Doors slide open as you approach.
        for (const d of doors) {
          const target = d.closedZ + (Math.abs(cam.x - d.x) < 2.2 ? 0.86 : 0);
          d.mesh.position.z += (target - d.mesh.position.z) * Math.min(1, dt * 6);
        }
        const nearEnd = cam.x < END + 0.6 || cam.x > LEN - END - 0.6;
        const idx = Math.min(units, Math.max(1, Math.floor((cam.x - END) / unitLen) + 1));
        const h = nearEnd ? "Door & washroom" : BL ? `Bay ${idx}` : `Row ${idx}`;
        if (h !== lastHint) setHint((lastHint = h));
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      setState("ready");

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener("keydown", kd);
        window.removeEventListener("keyup", ku);
        scene.traverse((o) => {
          o.geometry?.dispose?.();
          const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
          ms.forEach((m) => {
            m.map?.dispose?.();
            m.dispose?.();
          });
        });
        renderer.dispose();
        canvas.remove();
      };
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [cls, coach, seatKey]);

  // Stable callbacks (refs are only read inside event handlers, never during render).
  const control = useCallback((k, v) => api.current.set?.(k, v), []);
  const goHome = useCallback(() => api.current.home?.(), []);
  const pad = "grid size-11 place-items-center rounded-full bg-white/90 text-base font-bold text-ink shadow-md ring-1 ring-black/5 active:bg-accent active:text-white select-none";

  return (
    <figure className={`overflow-hidden rounded-2xl border border-line bg-[#dfe7f2] ${fill ? "flex min-h-0 flex-1 flex-col" : ""}`}>
      <div className={`relative ${fill ? "min-h-64 flex-1" : "h-[58dvh] max-h-[520px] min-h-[320px]"}`}>
        <div ref={host} className="absolute inset-0" aria-label={`Walk inside coach ${coach}`} role="img" />
        {state === "loading" && <p className="absolute inset-0 grid place-items-center text-sm text-muted">Boarding coach {coach}…</p>}
        {state === "nogl" && <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted">3D isn&apos;t supported on this device. Use the seat map instead.</p>}
        {state === "ready" && (
          <>
            <div className="pointer-events-none absolute top-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white">
              {coach} · {hint}
            </div>
            <button onClick={goHome} className="absolute top-2 right-2 rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-ink shadow">
              My {layoutFor(cls) ? "berth" : "seat"}
            </button>
            <div className="absolute right-0 bottom-3 left-0 flex items-end justify-between px-3">
              <div className="flex gap-2">
                <HoldButton className={pad} label="Turn left" onHold={(on) => control("turn", on ? -1 : 0)}>⟲</HoldButton>
                <HoldButton className={pad} label="Turn right" onHold={(on) => control("turn", on ? 1 : 0)}>⟳</HoldButton>
              </div>
              <p className="pointer-events-none mb-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white">Drag to look · hold to walk</p>
              <div className="flex flex-col gap-2">
                <HoldButton className={pad} label="Walk forward" onHold={(on) => control("fwd", on ? 1 : 0)}>▲</HoldButton>
                <HoldButton className={pad} label="Walk back" onHold={(on) => control("fwd", on ? -1 : 0)}>▼</HoldButton>
              </div>
            </div>
          </>
        )}
      </div>
    </figure>
  );
}

/** Button that reports press-and-hold (pointer down → true, released or left → false). */
function HoldButton({ className, label, onHold, children }) {
  return (
    <button
      className={className}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerLeave={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
