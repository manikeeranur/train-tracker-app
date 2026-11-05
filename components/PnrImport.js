"use client";

import { useActionState, useEffect, useRef } from "react";
import { importPnrs } from "@/app/actions";

export default function PnrImport({ prefill = "" }) {
  const [state, action, pending] = useActionState(importPnrs, null);
  const ref = useRef(null);
  useEffect(() => {
    if (state?.results?.some((r) => r.ok)) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <div>
        <label className="sr-only" htmlFor="pnr-text">PNRs or IRCTC booking history</label>
        <textarea
          id="pnr-text"
          name="text"
          rows={4}
          defaultValue={prefill}
          className="field font-mono text-sm"
          placeholder={"Paste IRCTC My Bookings / Booked Ticket History (best: train, times and route come along),\nor PNRs separated by commas, or an SMS / email."}
          required
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input name="label" className="field sm:max-w-xs" placeholder="Label (optional), e.g. Diwali trip" maxLength={40} />
        <button className="btn-primary sm:ml-auto" disabled={pending}>{pending ? "Fetching status…" : "Save & fetch"}</button>
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.results && (
        <ul className="space-y-1 text-sm">
          {state.results.map((r) => (
            <li key={r.pnr} className={r.ok ? "text-accent" : "text-danger"}>
              <span className="font-mono">{r.pnr}</span>: {r.msg}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
