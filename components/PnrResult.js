import Link from "next/link";
import { STATION_MAP } from "@/lib/data";
import { normalisePnr } from "@/lib/pnrs";
import { fmt12, fmtDate } from "@/lib/time";
import TrainIcon from "./TrainIcon";
import { inr } from "./ui";

function tone(s) {
  const v = String(s || "");
  if (/CAN/i.test(v)) return { fg: "text-muted", bg: "bg-surface-2", label: "Cancelled" };
  if (/WL|W\/L/i.test(v)) return { fg: "text-warn", bg: "bg-warn-soft", label: "Waitlist" };
  if (/RAC/i.test(v)) return { fg: "text-info", bg: "bg-info-soft", label: "RAC" };
  if (/CNF|CONFIRM/i.test(v)) return { fg: "text-accent", bg: "bg-accent-soft", label: "Confirmed" };
  return { fg: "text-muted", bg: "bg-surface-2", label: "Unknown" };
}

// "CNF/S4/33/LB" → { status: "CNF", detail: "S4 · 33 · LB" }
function split(s) {
  const [status, ...rest] = String(s || "—").split("/");
  return { status, detail: rest.join(" · ") };
}

const BERTH = { LB: "Lower", MB: "Middle", UB: "Upper", SL: "Side lower", SU: "Side upper", WS: "Window", MS: "Middle", AS: "Aisle" };

export default function PnrResult({ pnr, data, provider, cached, ms }) {
  const n = normalisePnr(data);
  const overall = tone(n.passengers.map((p) => p.current).join(" "));
  const nextDay = n.depDate && n.arrDate ? Math.round((Date.parse(n.arrDate) - Date.parse(n.depDate)) / 864e5) : 0;
  const fromName = STATION_MAP[n.from]?.name;
  const toName = STATION_MAP[n.to]?.name;
  const cnf = n.passengers.filter((p) => /CNF/i.test(p.current)).length;

  return (
    <article className="overflow-hidden rounded-3xl bg-surface">
      {/* Header */}
      <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6 ${overall.bg}`}>
        <div>
          <p className={`text-[11px] font-semibold tracking-[0.14em] uppercase ${overall.fg} opacity-80`}>PNR</p>
          <p className="font-mono text-2xl font-bold tracking-wider">{pnr.replace(/(\d{3})(\d{7})/, "$1-$2")}</p>
        </div>
        <div className="text-right">
          <span className={`inline-block rounded-full bg-surface px-3 py-1 text-sm font-bold ${overall.fg}`}>{overall.label}</span>
          {n.chartText && (
            <p className={`mt-1 text-xs font-medium ${n.chartPrepared === 1 ? "text-accent" : "text-muted"}`}>{n.chartText}</p>
          )}
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        {/* Train */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <TrainIcon className="size-7" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold tracking-tight">{n.trainName || "Train"}</p>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-medium text-muted">
                {n.trainNo && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono">#{n.trainNo}</span>}
                {n.cls && <span className="rounded-md bg-surface-2 px-1.5 py-0.5">{n.cls}</span>}
                {n.quota && <span className="rounded-md bg-surface-2 px-1.5 py-0.5">{n.quota} quota</span>}
              </div>
            </div>
          </div>
          {n.fare != null && (
            <div className="text-right">
              <p className="text-[11px] text-muted">Fare</p>
              <p className="text-lg font-semibold tabular-nums">{inr(n.fare)}</p>
            </div>
          )}
        </div>

        {/* Route */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(70px,1fr)_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-surface-2/60 p-4">
          <div className="min-w-0">
            <p className="text-2xl font-bold tracking-tight whitespace-nowrap tabular-nums">{n.depTime ? fmt12(n.depTime) : "--:--"}</p>
            <p className="truncate text-sm"><span className="font-semibold">{n.from || "—"}</span> <span className="hidden text-muted sm:inline">{fromName}</span></p>
            {n.depDate && <p className="text-xs text-muted">{fmtDate(n.depDate)}</p>}
          </div>
          <div className="flex flex-col items-center gap-1 text-[11px] text-muted">
            <span className="font-medium text-ink">{n.duration?.replace(/^0/, "") || ""}</span>
            <div className="flex w-full items-center">
              <span className="size-2 rounded-full border-2 border-accent" />
              <span className="flex-1 border-t-2 border-dotted border-line" />
              <TrainIcon className="mx-1 size-4 text-accent" />
              <span className="flex-1 border-t-2 border-dotted border-line" />
              <span className="size-2 rounded-full bg-accent" />
            </div>
            {n.boarding && n.boarding !== n.from ? <span>Board at {n.boarding}</span> : <span className="invisible">.</span>}
          </div>
          <div className="min-w-0 text-right">
            <p className="text-2xl font-bold tracking-tight whitespace-nowrap tabular-nums">
              {n.arrTime ? fmt12(n.arrTime) : "--:--"}
              {nextDay > 0 && <sup className="ml-0.5 text-[10px] font-semibold text-muted">+{nextDay}</sup>}
            </p>
            <p className="truncate text-sm"><span className="hidden text-muted sm:inline">{toName}</span> <span className="font-semibold">{n.to || "—"}</span></p>
            {n.arrDate && <p className="text-xs text-muted">{fmtDate(n.arrDate)}</p>}
          </div>
        </div>

        {/* Passengers */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-semibold">Passengers</h3>
            <span className="text-xs text-muted">{n.passengers.length} total{n.passengers.length ? ` · ${cnf} confirmed` : ""}</span>
          </div>
          {n.passengers.length === 0 ? (
            <p className="text-sm text-muted">No passenger details in the response.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {n.passengers.map((p) => {
                const b = split(p.booking);
                const c = split(p.current);
                const t = tone(p.current || p.booking);
                const berthCode = c.detail.split(" · ").at(-1);
                return (
                  <li key={p.n} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold">{p.n}</span>
                    <div className="min-w-24 text-xs text-muted">
                      <p>Booked</p>
                      <p className="font-mono text-sm text-ink">{b.status}{b.detail && <span className="text-muted"> {b.detail}</span>}</p>
                    </div>
                    <span className="text-muted" aria-hidden>→</span>
                    <div className="flex-1 text-xs text-muted">
                      <p>Current</p>
                      <p className={`font-mono text-sm font-semibold ${t.fg}`}>
                        {c.status}{c.detail && <span> {c.detail}</span>}
                      </p>
                    </div>
                    {BERTH[berthCode] && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${t.bg} ${t.fg}`}>{BERTH[berthCode]} berth</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-[11px] text-muted">
            Source: {provider} · {cached ? "from cache" : `${ms} ms`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/bookings?add=${pnr}`} className="btn-primary py-2">Save to My bookings</Link>
            {n.trainNo && <Link href={`/live?tab=running&go=1&train=${n.trainNo}`} className="btn-ghost py-2">Track train</Link>}
          </div>
        </div>

        <details className="text-xs">
          <summary className="cursor-pointer text-muted">Raw response</summary>
          <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-surface-2 p-3">{JSON.stringify(data, null, 2)}</pre>
        </details>
      </div>
    </article>
  );
}
