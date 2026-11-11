"use client";

import { useEffect, useRef, useState } from "react";

// 3D live view: the train running along the track between station boards, positioned by
// the live / estimated km. three.js is loaded on demand.
// World units: x along the line (KM units per km), z across (track at z = 0), y up.

const KM = 4; // world units per km (compressed so stations stay a few seconds apart)
const SLEEPERS = 260;
const SLEEPER_GAP = 0.6;

// Yellow Indian Railways station board as a canvas texture.
function boardTexture(THREE, name, code, small) {
  const c = document.createElement("canvas");
  c.width = small ? 384 : 768;
  c.height = small ? 96 : 192;
  const g = c.getContext("2d");
  g.fillStyle = "#f7c600";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#111";
  g.lineWidth = small ? 6 : 10;
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, c.width - g.lineWidth, c.height - g.lineWidth);
  g.fillStyle = "#111";
  g.textAlign = "center";
  const max = c.width - 40;
  let size = small ? 44 : 86;
  g.font = `900 ${size}px system-ui, sans-serif`;
  while (g.measureText(name).width > max && size > 18) {
    size -= 2;
    g.font = `900 ${size}px system-ui, sans-serif`;
  }
  g.fillText(name, c.width / 2, small ? 58 : code ? 104 : 120);
  if (code && !small) {
    g.font = "700 40px system-ui, sans-serif";
    g.fillText(code, c.width / 2, 160);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * stations: [{ name, code, km, nonStop }] in route order. km: train position (km from origin).
 * moving: true while the train is running (wheels / camera sway).
 */
export default function LiveTrain3D({ stations, km, moving, nextName }) {
  const host = useRef(null);
  const target = useRef(km ?? 0);
  const [state, setState] = useState("loading");
  const routeKey = JSON.stringify(stations.map((s) => [s.name, s.code, s.km, !!s.nonStop]));

  useEffect(() => {
    target.current = km ?? 0;
  }, [km]);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import("three");
      if (disposed || !host.current) return;
      const el = host.current;
      const route = JSON.parse(routeKey).map(([name, code, k, nonStop]) => ({ name, code, km: k, nonStop }));
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
      } catch {
        setState("nogl");
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xbfe3f7);
      scene.fog = new THREE.Fog(0xbfe3f7, 40, 140);
      const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 400);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x6f8f5f, 1.9));
      const sun = new THREE.DirectionalLight(0xfff2d6, 1.4);
      sun.position.set(-30, 50, 25);
      scene.add(sun);

      const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
      const add = (geo, m, x, y, z, parent = scene) => {
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(x, y, z);
        parent.add(mesh);
        return mesh;
      };
      const total = Math.max(1, ...route.map((s) => s.km ?? 0));
      const len = total * KM + 120;

      // ground, ballast, rails (long strips)
      add(new THREE.BoxGeometry(len, 0.1, 160), mat(0x8cc46a), len / 2 - 60, -0.15, 0);
      add(new THREE.BoxGeometry(len, 0.12, 3.2), mat(0x9a948a), len / 2 - 60, -0.04, 0);
      for (const z of [-0.72, 0.72]) add(new THREE.BoxGeometry(len, 0.12, 0.09), mat(0xb8c0c8, { metalness: 0.7, roughness: 0.3 }), len / 2 - 60, 0.2, z);
      // sleepers: a pool recycled around the train
      const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.1, 2.3), mat(0x6b5a48), SLEEPERS);
      scene.add(sleepers);
      const dummy = new THREE.Object3D();
      const placeSleepers = (cx) => {
        const start = Math.floor(cx / SLEEPER_GAP) * SLEEPER_GAP - (SLEEPERS / 2) * SLEEPER_GAP;
        for (let i = 0; i < SLEEPERS; i++) {
          dummy.position.set(start + i * SLEEPER_GAP, 0.08, 0);
          dummy.updateMatrix();
          sleepers.setMatrixAt(i, dummy.matrix);
        }
        sleepers.instanceMatrix.needsUpdate = true;
      };

      // trees and electric poles along the line (deterministic)
      let seed = 7;
      const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const trunk = mat(0x7a5a3a);
      const leaves = [mat(0x4f9b5a), mat(0x6bb36a), mat(0x3f8a4f)];
      const trunkG = new THREE.CylinderGeometry(0.12, 0.16, 1.2, 6);
      const crownG = new THREE.SphereGeometry(1, 10, 8);
      for (let x = -40; x < len - 60; x += 3 + r() * 5) {
        // Camera sits on the -z side, so trees there stay well back from the track.
        const z = r() < 0.5 ? -(18 + r() * 25) : 7 + r() * 30;
        add(trunkG, trunk, x, 0.5, z);
        add(crownG, leaves[Math.floor(r() * 3)], x, 1.6 + r() * 0.6, z).scale.setScalar(0.9 + r() * 0.8);
      }
      const poleG = new THREE.CylinderGeometry(0.06, 0.06, 4.2, 6);
      const armG = new THREE.BoxGeometry(0.08, 0.08, 2.0);
      const poleM = mat(0x8d969e, { metalness: 0.5 });
      for (let x = -40; x < len - 60; x += 12) {
        add(poleG, poleM, x, 2.0, -2.4);
        add(armG, poleM, x, 3.9, -1.5);
      }
      add(new THREE.BoxGeometry(len, 0.03, 0.03), mat(0x333333), len / 2 - 60, 3.75, -0.6); // overhead wire

      // stations: platforms + boards
      const boardMats = [];
      for (const s of route) {
        if (s.km == null) continue;
        const x = s.km * KM;
        if (!s.nonStop) {
          add(new THREE.BoxGeometry(14, 0.8, 3), mat(0xd9d2c3), x, 0.4, 3.4); // platform
          add(new THREE.BoxGeometry(14, 0.05, 0.25), mat(0xf2d200), x, 0.82, 2.05); // yellow edge
          add(new THREE.BoxGeometry(6, 0.12, 2.6), mat(0x9b4b3a), x, 3.0, 3.9); // shelter roof
          for (const dx of [-2.6, 2.6]) add(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6), poleM, x + dx, 1.9, 4.6);
        }
        const tex = boardTexture(THREE, s.name || s.code || "", s.nonStop ? "" : s.code, s.nonStop);
        const bm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
        boardMats.push(bm);
        const w = s.nonStop ? 2.6 : 5.2;
        const h = s.nonStop ? 0.65 : 1.3;
        const board = add(new THREE.PlaneGeometry(w, h), bm, x, s.nonStop ? 2.0 : 2.4, s.nonStop ? 2.4 : 4.9);
        board.rotation.y = Math.PI; // face the track / camera (camera is on the -z side)
        const back = add(new THREE.PlaneGeometry(w, h), bm, x, board.position.y, board.position.z + 0.02);
        back.rotation.y = 0;
        for (const dx of [-w / 2 + 0.2, w / 2 - 0.2]) add(new THREE.CylinderGeometry(0.05, 0.05, board.position.y, 6), poleM, x + dx, board.position.y / 2, board.position.z + 0.05);
      }

      // the train: WAP-7 style engine + blue coaches
      const train = new THREE.Group();
      const coachM = mat(0x2f5fa3);
      const stripeM = mat(0xf2f2f2);
      const roofM = mat(0x9aa4ad);
      const winM = new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.2, metalness: 0.3 });
      const wheelM = mat(0x222222);
      const wheelG = new THREE.CylinderGeometry(0.32, 0.32, 0.15, 12);
      const wheels = [];
      const vehicle = (x, length, body, isEngine) => {
        add(new THREE.BoxGeometry(length, 1.9, 2.4), body, x, 1.55, 0, train);
        add(new THREE.BoxGeometry(length, 0.18, 2.42), stripeM, x, 1.2, 0, train);
        add(new THREE.BoxGeometry(length - 0.2, 0.25, 2.1), roofM, x, 2.6, 0, train);
        if (!isEngine) for (let k = -length / 2 + 0.6; k < length / 2 - 0.4; k += 0.9) for (const z of [-1.21, 1.21]) add(new THREE.BoxGeometry(0.55, 0.45, 0.02), winM, x + k, 1.75, z, train);
        for (const dx of [-length / 2 + 0.8, -length / 2 + 1.5, length / 2 - 1.5, length / 2 - 0.8]) {
          for (const z of [-0.72, 0.72]) {
            const w = add(wheelG, wheelM, x + dx, 0.45, z, train);
            w.rotation.x = Math.PI / 2;
            wheels.push(w);
          }
        }
      };
      const ENGINE = 5.5;
      const COACH = 6.2;
      const engineM = mat(0xc8322b);
      vehicle(0, ENGINE, engineM, true);
      add(new THREE.BoxGeometry(0.1, 0.7, 1.9), winM, ENGINE / 2 + 0.01, 2.0, 0, train); // cab windscreen
      const lamp = add(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff6c2, emissive: 0xfff2a0, emissiveIntensity: 2 }), ENGINE / 2 + 0.02, 2.5, 0, train);
      lamp.scale.set(0.5, 1, 1);
      add(new THREE.BoxGeometry(0.6, 0.5, 0.06), mat(0x222222), 0.5, 3.0, 0, train); // pantograph
      for (let i = 0; i < 6; i++) vehicle(-ENGINE / 2 - 0.3 - COACH / 2 - i * (COACH + 0.3), COACH, coachM, false);
      scene.add(train);

      // camera: chase view; drag to orbit around the train
      let yaw = -0.55;
      let pitch = 0.32;
      let drag = null;
      const canvas = renderer.domElement;
      canvas.style.touchAction = "none";
      canvas.addEventListener("pointerdown", (e) => {
        drag = { x: e.clientX, y: e.clientY, yaw, pitch };
        canvas.setPointerCapture?.(e.pointerId);
      });
      canvas.addEventListener("pointermove", (e) => {
        if (!drag) return;
        yaw = drag.yaw + (e.clientX - drag.x) * 0.006;
        pitch = Math.max(0.08, Math.min(1.2, drag.pitch + (e.clientY - drag.y) * 0.004));
      });
      const up = () => (drag = null);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);

      const ro = new ResizeObserver(() => {
        renderer.setSize(el.clientWidth, el.clientHeight);
        camera.aspect = el.clientWidth / el.clientHeight;
        camera.updateProjectionMatrix();
      });
      ro.observe(el);

      let x = target.current * KM;
      let lastSleeper = Infinity;
      let last = performance.now();
      let raf;
      const tick = (t) => {
        const dt = Math.min(0.05, (t - last) / 1000);
        last = t;
        const goal = target.current * KM;
        const step = goal - x;
        x += Math.abs(step) > 40 ? step : step * Math.min(1, dt * 1.5); // glide; jump on big corrections
        train.position.x = x;
        if (moving) for (const w of wheels) w.rotation.y += dt * 8;
        if (Math.abs(x - lastSleeper) > 30) placeSleepers((lastSleeper = x));
        const dist = 16;
        const cx = x - 2;
        camera.position.set(cx + Math.sin(yaw) * dist * Math.cos(pitch), 1.6 + Math.sin(pitch) * dist, -Math.cos(yaw) * dist * Math.cos(pitch));
        camera.lookAt(cx + 3, 1.4, 0);
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      setState("ready");

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
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
  }, [routeKey, moving]);

  return (
    <div className="relative h-64 overflow-hidden rounded-2xl border border-line bg-[#bfe3f7] sm:h-80">
      <div ref={host} className="absolute inset-0" role="img" aria-label="3D view of the train on its route" />
      {state === "loading" && <p className="absolute inset-0 grid place-items-center text-sm text-muted">Loading 3D view…</p>}
      {state === "nogl" && <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted">3D isn&apos;t supported on this device.</p>}
      {state === "ready" && nextName && (
        <div className="pointer-events-none absolute top-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white">{nextName}</div>
      )}
      {state === "ready" && <p className="pointer-events-none absolute right-2 bottom-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white">Drag to look around</p>}
    </div>
  );
}
