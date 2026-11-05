"use client";

import { useActionState, useEffect, useRef } from "react";
import { addPassenger } from "@/app/actions";
import { BERTH_LABELS } from "@/lib/data";

export default function PassengerForm() {
  const [state, action, pending] = useActionState(addPassenger, null);
  const ref = useRef(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="card grid gap-3 p-4 sm:grid-cols-[1fr_90px_120px_160px_auto] sm:items-end">
      <div>
        <label className="label" htmlFor="p-name">Name</label>
        <input id="p-name" name="name" className="field" maxLength={40} required />
      </div>
      <div>
        <label className="label" htmlFor="p-age">Age</label>
        <input id="p-age" name="age" type="number" min={1} max={120} className="field" required />
      </div>
      <div>
        <label className="label" htmlFor="p-gender">Gender</label>
        <select id="p-gender" name="gender" className="field">
          <option value="M">Male</option>
          <option value="F">Female</option>
          <option value="T">Transgender</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="p-berth">Berth pref.</label>
        <select id="p-berth" name="berth_pref" className="field">
          <option value="NP">No preference</option>
          {Object.entries(BERTH_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v} ({k})</option>
          ))}
        </select>
      </div>
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Add"}</button>
      {state?.error && <p className="text-sm text-danger sm:col-span-5">{state.error}</p>}
    </form>
  );
}
