"use client";

import { useTransition } from "react";
import { deleteCompletedTracked, deleteTracked } from "@/app/actions";

/** Removes a tracked PNR (and its status history) after a confirm. */
export default function DeleteTicket({ id, pnr, large = false }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete PNR ${pnr} from My bookings? Its status history is removed too.`)) return;
        const form = new FormData();
        form.set("id", String(id));
        start(() => deleteTracked(form));
      }}
      className={`grid place-items-center text-muted transition ${large ? "size-9 rounded-full" : "size-7 rounded-lg"} hover:bg-danger-soft hover:text-danger disabled:opacity-50`}
      aria-label={`Delete PNR ${pnr}`}
      title="Delete"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={large ? "size-5" : "size-4"} aria-hidden="true">
        <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.7 10.1a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4l.7-10.1M8.5 9v5M11.5 9v5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** Deletes every completed journey after a confirm. */
export function DeleteCompleted({ count }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete all ${count} completed journey${count > 1 ? "s" : ""}? This can't be undone.`)) return;
        start(() => deleteCompletedTracked());
      }}
      className="btn-ghost py-1.5 text-sm text-danger disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete all completed"}
    </button>
  );
}
