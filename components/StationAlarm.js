"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sheet from "./Sheet";

// Station alarm while the tracker is open: rings (sound + vibration + notification + banner)
// when the train gets within N km / N minutes of the chosen station. Saved per train run in
// localStorage. Keeps the screen awake while armed so phones don't freeze the page.

export const ALARM_OPTIONS = [
  { mode: "km", value: 5, label: "5 km before" },
  { mode: "km", value: 10, label: "10 km before" },
  { mode: "km", value: 20, label: "20 km before" },
  { mode: "min", value: 15, label: "15 min before" },
  { mode: "min", value: 30, label: "30 min before" },
];
const describe = (a) => (a.mode === "km" ? `${a.value} km before` : `${a.value} min before`);

/** Alarm saved for this train run: { code, name, km, mode, value, fired } | null. */
export function useAlarm(key) {
  const [alarm, setState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  });
  const save = useCallback(
    (a) => {
      setState(a);
      try {
        if (a) localStorage.setItem(key, JSON.stringify(a));
        else localStorage.removeItem(key);
      } catch {
        /* private mode: alarm still works for this visit */
      }
    },
    [key]
  );
  return [alarm, save];
}

/** Bell button for a station row. */
export function AlarmBell({ active, onClick, name }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? `Alarm set for ${name}` : `Set alarm for ${name}`}
      title={active ? "Alarm set" : "Set alarm"}
      className={`grid size-7 shrink-0 place-items-center rounded-full transition ${active ? "bg-warn-soft text-warn" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    </button>
  );
}

/** Sheet to choose when to ring for a station (minutes need an expected arrival time). */
export function AlarmPicker({ station, current, onSet, onClear, onClose }) {
  return (
    <Sheet open={Boolean(station)} onClose={onClose} title={station ? `Alarm for ${station.name}` : "Alarm"}>
      {station && (
        <div className="space-y-3">
          <p className="text-sm text-muted">Ring when the train is close to this station. Keep RailGo open; the screen stays on while the alarm is set.</p>
          <div className="grid grid-cols-2 gap-2">
            {ALARM_OPTIONS.filter((o) => o.mode === "km" || station.hasEta).map((o) => {
              const on = current && current.code === station.code && current.name === station.name && current.mode === o.mode && current.value === o.value;
              return (
                <button
                  key={o.label}
                  onClick={() => onSet(o)}
                  className={`rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 transition ${on ? "bg-accent text-accent-ink ring-accent" : "bg-surface text-ink ring-line hover:bg-surface-2"}`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {current && current.code === station.code && current.name === station.name && (
            <button onClick={onClear} className="w-full rounded-xl py-2.5 text-sm font-semibold text-danger hover:bg-danger-soft">
              Remove alarm
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** Short summary chip for the hero card. */
export function AlarmChip({ alarm, onEdit, onClear }) {
  if (!alarm) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-warn-soft py-1 pr-1 pl-2.5 text-[11px] font-semibold text-warn">
      <span aria-hidden>🔔</span>
      <button onClick={onEdit} className="truncate text-left">
        {alarm.name} · {describe(alarm)}
        {alarm.fired && " · rang"}
      </button>
      <button onClick={onClear} className="grid size-5 place-items-center rounded-full hover:bg-warn/15" aria-label="Remove alarm">
        ✕
      </button>
    </div>
  );
}

// ---- ringing ----
function useBeeper() {
  const ctx = useRef(null);
  const timer = useRef(null);
  const stop = useCallback(() => {
    clearInterval(timer.current);
    timer.current = null;
    navigator.vibrate?.(0);
  }, []);
  const start = useCallback(() => {
    if (timer.current) return;
    try {
      ctx.current ??= new (window.AudioContext || window.webkitAudioContext)();
      ctx.current.resume?.();
    } catch {
      ctx.current = null;
    }
    const beep = () => {
      const ac = ctx.current;
      if (ac) {
        for (let k = 0; k < 3; k++) {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = "square";
          o.frequency.value = k % 2 ? 880 : 1175;
          const t0 = ac.currentTime + k * 0.22;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
          o.connect(g).connect(ac.destination);
          o.start(t0);
          o.stop(t0 + 0.2);
        }
      }
      navigator.vibrate?.([400, 150, 400, 150, 400]);
    };
    beep();
    timer.current = setInterval(beep, 1500);
  }, []);
  // Unlock audio on the user's tap when they set the alarm (browsers block sound otherwise).
  const prime = useCallback(() => {
    try {
      ctx.current ??= new (window.AudioContext || window.webkitAudioContext)();
      ctx.current.resume?.();
    } catch {
      /* no audio */
    }
  }, []);
  useEffect(() => stop, [stop]);
  return { start, stop, prime };
}

async function notify(title, body) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) await reg.showNotification(title, { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "railgo-alarm", renotify: true, vibrate: [400, 150, 400] });
    else new Notification(title, { body, icon: "/icons/icon-192.png" });
  } catch {
    /* notifications unavailable */
  }
}

export function askNotificationPermission() {
  try {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  } catch {
    /* ignore */
  }
}

/**
 * Watches the train against the alarm and rings once it's within range.
 * kmToGo: km left to the station (null if unknown); minToGo: minutes to its expected arrival.
 */
export function AlarmRinger({ alarm, kmToGo, minToGo, onFired, onStop, beeper }) {
  const [ringing, setRinging] = useState(false);
  const due =
    alarm &&
    !alarm.fired &&
    ((alarm.mode === "km" && kmToGo != null && kmToGo <= alarm.value) || (alarm.mode === "min" && minToGo != null && minToGo <= alarm.value));

  useEffect(() => {
    if (!due) return;
    onFired();
    beeper.start();
    notify(`${alarm.name} is coming up`, alarm.mode === "km" ? `About ${Math.max(0, Math.round(kmToGo))} km to go` : `About ${Math.max(0, Math.round(minToGo))} min to go`);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ringing starts in response to the train reaching range
    setRinging(true);
  }, [due, alarm, kmToGo, minToGo, onFired, beeper]);

  // Keep the screen awake while an alarm is armed so the page keeps tracking.
  useEffect(() => {
    if (!alarm || alarm.fired) return;
    let lock = null;
    const take = async () => {
      try {
        lock = await navigator.wakeLock?.request("screen");
      } catch {
        lock = null;
      }
    };
    take();
    const again = () => document.visibilityState === "visible" && take();
    document.addEventListener("visibilitychange", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
      lock?.release?.();
    };
  }, [alarm]);

  if (!ringing) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-50 rounded-2xl bg-warn p-4 text-white shadow-2xl" role="alertdialog" aria-live="assertive" style={{ marginTop: "env(safe-area-inset-top)" }}>
      <p className="text-xs font-semibold tracking-wide uppercase opacity-90">🔔 Station alarm</p>
      <p className="mt-1 text-lg font-bold">{alarm.name} is coming up</p>
      <p className="text-sm opacity-90">
        {kmToGo != null && `≈ ${Math.max(0, Math.round(kmToGo))} km to go`}
        {minToGo != null && ` · ≈ ${Math.max(0, Math.round(minToGo))} min`}
      </p>
      <button
        onClick={() => {
          beeper.stop();
          setRinging(false);
          onStop();
        }}
        className="mt-3 w-full rounded-xl bg-white py-2.5 text-sm font-bold text-warn"
      >
        Stop alarm
      </button>
    </div>
  );
}

export { useBeeper };
