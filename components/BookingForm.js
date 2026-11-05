"use client";

import { useActionState, useState } from "react";
import { book } from "@/app/actions";
import { BERTH_LABELS } from "@/lib/data";
import { inr } from "./ui";
import Countdown from "./Countdown";

const blank = () => ({ key: crypto.randomUUID(), name: "", age: "", gender: "M", berthPref: "NP" });

export default function BookingForm({ hidden, saved, maxPassengers, pattern, fares, scheduled, closed, opensAt, opensLabel }) {
  const [state, action, pending] = useActionState(book, null);
  const [pax, setPax] = useState(() => (saved.length ? [] : [blank()]));

  const picked = new Set(pax.map((p) => p.savedId).filter(Boolean));
  const full = pax.length >= maxPassengers;

  function addSaved(s) {
    if (picked.has(s.id)) {
      setPax(pax.filter((p) => p.savedId !== s.id));
    } else if (!full) {
      setPax([...pax, { key: `s${s.id}`, savedId: s.id, name: s.name, age: String(s.age), gender: s.gender, berthPref: pattern.includes(s.berth_pref) ? s.berth_pref : "NP" }]);
    }
  }
  const update = (key, patch) => setPax(pax.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const fareOf = (age) => {
    const a = Number(age);
    if (!a) return 0;
    if (a < 5) return 0;
    if (a < 12) return fares.child;
    return fares.adult;
  };
  const total = pax.reduce((s, p) => s + fareOf(p.age), 0);
  const payload = JSON.stringify(pax.map(({ name, age, gender, berthPref }) => ({ name, age: Number(age), gender, berthPref })));

  return (
    <form action={action} className="space-y-6">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="passengers" value={payload} />

      {scheduled && (
        <div className="card flex flex-wrap items-center gap-4 border-info/40 bg-info-soft p-4">
          <div className="flex-1">
            <p className="font-semibold text-info">Booking window not open yet</p>
            <p className="text-sm text-muted">Opens {opensLabel}. Schedule now. RailGo books at the exact second it opens.</p>
          </div>
          <Countdown target={opensAt} className="text-2xl font-semibold text-info" />
        </div>
      )}

      {saved.length > 0 && (
        <section>
          <h2 className="label">Saved passengers</h2>
          <div className="flex flex-wrap gap-2">
            {saved.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => addSaved(s)}
                disabled={!picked.has(s.id) && full}
                className={`btn py-1.5 ${picked.has(s.id) ? "bg-accent text-accent-ink" : "border border-line bg-surface hover:bg-surface-2"}`}
              >
                {picked.has(s.id) ? "✓ " : "+ "}
                {s.name} <span className="font-normal opacity-70">{s.age}{s.gender}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="label mb-0">Passengers ({pax.length}/{maxPassengers})</h2>
          <button type="button" className="btn-ghost py-1.5" disabled={full} onClick={() => setPax([...pax, blank()])}>
            + Add passenger
          </button>
        </div>
        {pax.length === 0 && <p className="card p-4 text-sm text-muted">Tap a saved passenger above or add a new one.</p>}
        {pax.map((p, i) => (
          <div key={p.key} className="card grid gap-3 p-4 sm:grid-cols-[1fr_80px_110px_150px_auto] sm:items-end">
            <div>
              <label className="label">{i + 1}. Name</label>
              <input className="field" value={p.name} onChange={(e) => update(p.key, { name: e.target.value })} placeholder="As on ID" required maxLength={40} />
            </div>
            <div>
              <label className="label">Age</label>
              <input className="field" type="number" min={1} max={120} value={p.age} onChange={(e) => update(p.key, { age: e.target.value })} required />
            </div>
            <div>
              <label className="label">Gender</label>
              <select className="field" value={p.gender} onChange={(e) => update(p.key, { gender: e.target.value })}>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="T">Transgender</option>
              </select>
            </div>
            <div>
              <label className="label">Berth pref.</label>
              <select className="field" value={p.berthPref} onChange={(e) => update(p.key, { berthPref: e.target.value })}>
                <option value="NP">No preference</option>
                {pattern.map((b) => (
                  <option key={b} value={b}>{BERTH_LABELS[b]} ({b})</option>
                ))}
              </select>
            </div>
            <button type="button" className="btn-ghost text-muted" onClick={() => setPax(pax.filter((x) => x.key !== p.key))} aria-label={`Remove passenger ${i + 1}`}>
              ✕
            </button>
          </div>
        ))}
      </section>

      <section className="card space-y-3 p-4">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="accept_wl" defaultChecked className="mt-0.5 size-4 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">Book even if only waitlist is available</span>
            <span className="block text-muted">Untick to book only when every passenger gets a confirmed berth.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="save_passengers" defaultChecked className="mt-0.5 size-4 accent-[var(--accent)]" />
          <span className="font-medium">Save new passengers to my list</span>
        </label>
        <p className="text-xs text-muted">Seniors (60+) and women 45+ are given lower berths first when available.</p>
      </section>

      {state?.error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{state.error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-lg">
          Total <span className="font-semibold">{inr(total)}</span>
        </p>
        <button className="btn-primary px-6 py-3 text-base" disabled={pending || closed || pax.length === 0}>
          {pending ? "Working…" : closed ? "Booking closed" : scheduled ? "Schedule auto-book" : "Book now"}
        </button>
      </div>
    </form>
  );
}
