"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { QUOTAS, STATIONS } from "@/lib/data";

const label = (s) => `${s.name} (${s.code})`;
const byLabel = Object.fromEntries(STATIONS.map((s) => [label(s).toLowerCase(), s.code]));
const byCode = Object.fromEntries(STATIONS.map((s) => [s.code, s]));

function resolve(text) {
  const t = text.trim().toLowerCase();
  if (byLabel[t]) return byLabel[t];
  const code = t.toUpperCase();
  if (byCode[code]) return code;
  const hit = STATIONS.find((s) => s.name.toLowerCase().startsWith(t) || s.city.toLowerCase() === t);
  return hit?.code ?? null;
}

export default function SearchForm({ initial, minDate, maxDate }) {
  const router = useRouter();
  const [from, setFrom] = useState(initial.from ? label(byCode[initial.from]) : "");
  const [to, setTo] = useState(initial.to ? label(byCode[initial.to]) : "");
  const [date, setDate] = useState(initial.date);
  const [quota, setQuota] = useState(initial.quota || "GN");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    const f = resolve(from);
    const t = resolve(to);
    if (!f || !t) return setError("Pick stations from the list.");
    if (f === t) return setError("From and To can't be the same.");
    setError("");
    router.push(`/trains?from=${f}&to=${t}&date=${date}&quota=${quota}`);
  }

  return (
    <form onSubmit={submit} className="card grid gap-4 p-4 sm:p-6 md:grid-cols-[1fr_auto_1fr]">
      <datalist id="stations">
        {STATIONS.map((s) => (
          <option key={s.code} value={label(s)} />
        ))}
      </datalist>
      <div>
        <label className="label" htmlFor="from">From</label>
        <input id="from" className="field" list="stations" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Chennai Egmore (MS)" autoComplete="off" required />
      </div>
      <button
        type="button"
        onClick={() => { setFrom(to); setTo(from); }}
        className="btn-ghost self-end justify-self-center px-3"
        aria-label="Swap stations"
      >
        ⇄
      </button>
      <div>
        <label className="label" htmlFor="to">To</label>
        <input id="to" className="field" list="stations" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Madurai Jn (MDU)" autoComplete="off" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-3 md:col-span-3">
        <div>
          <label className="label" htmlFor="date">Journey date</label>
          <input id="date" type="date" className="field" value={date} min={minDate} max={maxDate} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="quota">Quota</label>
          <select id="quota" className="field" value={quota} onChange={(e) => setQuota(e.target.value)}>
            {Object.entries(QUOTAS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full py-3">Search trains</button>
        </div>
      </div>
      {error && <p className="text-sm text-danger md:col-span-3">{error}</p>}
    </form>
  );
}
