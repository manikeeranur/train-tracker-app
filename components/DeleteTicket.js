"use client";

import { useState, useTransition } from "react";
import { deleteCompletedTracked, deleteTracked } from "@/app/actions";
import { ConfirmSheet } from "./Sheet";

/** Removes a tracked PNR (and its status history) after confirming in a sheet. */
export default function DeleteTicket({ id, pnr, large = false }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className={`grid place-items-center text-muted transition ${large ? "size-9 rounded-full" : "size-7 rounded-lg"} hover:bg-danger-soft hover:text-danger disabled:opacity-50`}
        aria-label={`Delete PNR ${pnr}`}
        title="Delete"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={large ? "size-5" : "size-4"} aria-hidden="true">
          <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.7 10.1a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4l.7-10.1M8.5 9v5M11.5 9v5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        pending={pending}
        title="Delete this ticket?"
        message={<>PNR <span className="font-mono font-semibold text-ink">{pnr}</span> and its status history will be removed from My bookings. This can&apos;t be undone.</>}
        onConfirm={() => {
          const form = new FormData();
          form.set("id", String(id));
          start(async () => {
            await deleteTracked(form);
            setOpen(false);
          });
        }}
      />
    </>
  );
}

/** Deletes every completed journey after confirming in a sheet. */
export function DeleteCompleted({ count }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" disabled={pending} onClick={() => setOpen(true)} className="btn-ghost py-1.5 text-sm text-danger disabled:opacity-50">
        {pending ? "Deleting…" : "Delete all completed"}
      </button>
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        pending={pending}
        title={`Delete ${count} completed journey${count > 1 ? "s" : ""}?`}
        message="All completed tickets and their status history will be removed. This can't be undone."
        confirmLabel="Delete all"
        onConfirm={() =>
          start(async () => {
            await deleteCompletedTracked();
            setOpen(false);
          })
        }
      />
    </>
  );
}
