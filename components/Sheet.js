"use client";

import { useEffect, useRef } from "react";

/**
 * Modal that slides up from the bottom on phones and sits centred on larger screens.
 * Built on <dialog>: Esc and the backdrop close it, focus stays inside while open.
 */
export default function Sheet({ open, onClose, title, children, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={`m-0 mt-auto w-full max-w-none rounded-t-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/45 open:animate-[sheet-up_.25s_ease-out] sm:m-auto sm:max-w-xl sm:rounded-3xl ${className}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {open && (
        <div className="max-h-[88dvh] overflow-y-auto">
          <div className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-surface/95 px-4 pt-3 pb-2 backdrop-blur">
            <span className="mx-auto h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 pb-2">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            <button onClick={onClose} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
              <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M5 5l10 10M15 5 5 15" /></svg>
            </button>
          </div>
          <div className="px-4 pb-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** Yes / no confirmation in the same sheet style. */
export function ConfirmSheet({ open, onClose, onConfirm, title, message, confirmLabel = "Delete", pending = false }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-sm text-muted">{message}</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button onClick={onClose} className="btn-ghost py-2.5" autoFocus>Cancel</button>
        <button onClick={onConfirm} disabled={pending} className="rounded-xl bg-danger py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Deleting…" : confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
