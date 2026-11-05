"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { syncMyPnrs } from "@/app/actions";

/** On page open, refreshes stale PNRs in the background, then re-renders from the DB. */
export default function AutoSync({ stale }) {
  const router = useRouter();
  const started = useRef(false);
  const [msg, setMsg] = useState(stale ? `Syncing ${stale} PNR${stale > 1 ? "s" : ""}…` : "All PNRs up to date");

  useEffect(() => {
    if (!stale || started.current) return;
    started.current = true;
    syncMyPnrs()
      .then((r) => {
        setMsg(r.changed ? `Synced · ${r.changed} status change${r.changed > 1 ? "s" : ""}` : "Synced · no changes");
        router.refresh();
      })
      .catch(() => setMsg("Sync failed. Try Refresh on a PNR."));
  }, [stale, router]);

  return (
    <span className={`chip ${stale ? "bg-info-soft text-info" : "bg-surface-2 text-muted"}`} aria-live="polite">
      {msg}
    </span>
  );
}
