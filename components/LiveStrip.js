"use client";

import { useEffect, useState } from "react";
import { liveRunning } from "@/app/actions";

const POLL_MS = 2 * 60e3;

/** One-line live position shown next to "Track train" on travel day. No device location needed. */
export default function LiveStrip({ trainNo, startDay }) {
  const [s, setS] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      liveRunning(trainNo, startDay)
        .then((r) => alive && setS(r))
        .catch(() => alive && setS({ error: "Live position unavailable" }));
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [trainNo, startDay]);

  if (!s) return <span className="text-[11px] text-muted">Locating train…</span>;
  if (s.error) return <span className="text-[11px] text-muted">{s.error}</span>;
  const delay = Number(s.delay);
  return (
    <span className="max-w-56 truncate text-right text-[11px] text-ink" title={s.text}>
      <span className="font-medium">{s.text}</span>
      {s.started && !s.ended && Number.isFinite(delay) && (
        <span className={`font-semibold ${delay > 0 ? "text-warn" : "text-accent"}`}> · {delay > 0 ? `${delay}m late` : "on time"}</span>
      )}
    </span>
  );
}
