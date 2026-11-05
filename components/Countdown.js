"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

// One shared 250ms clock for every countdown on the page.
let now = null;
const listeners = new Set();
let timer = null;
function subscribe(fn) {
  listeners.add(fn);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 250);
  }
  return () => {
    listeners.delete(fn);
    if (!listeners.size) {
      clearInterval(timer);
      timer = null;
    }
  };
}
export function useNow() {
  return useSyncExternalStore(subscribe, () => now, () => null);
}

function parts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/** Live countdown to `target`. With `refreshOnZero`, keeps re-rendering the page once the target passes. */
export default function Countdown({ target, refreshOnZero = false, className = "" }) {
  const router = useRouter();
  const t = useNow();
  const passed = t != null && t >= target;

  useEffect(() => {
    if (!refreshOnZero || !passed) return;
    // The server scheduler ticks every second; refresh until the status flips.
    const id = setInterval(() => router.refresh(), 1000);
    return () => clearInterval(id);
  }, [refreshOnZero, passed, router]);

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {t == null ? "--:--:--" : passed ? "00:00:00" : parts(target - t)}
    </span>
  );
}
