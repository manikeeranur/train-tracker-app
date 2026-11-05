import Link from "next/link";
import TrainIcon from "./TrainIcon";
import { inr } from "./ui";

const CLASS_ORDER = ["1A", "EC", "2A", "EA", "3A", "3E", "CC", "SL", "2S"];
const prettyType = (t) => String(t || "").replace(/_/g, " ").toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function isFareList(data) {
  return Array.isArray(data?.trains);
}

export default function FareResults({ data, query }) {
  const train = query.train || "";
  const cls = query.cls || "";
  let trains = data.trains.map((t) => ({
    ...t,
    fares: (t.fares || []).slice().sort((a, b) => CLASS_ORDER.indexOf(a.class) - CLASS_ORDER.indexOf(b.class)),
  }));
  const wanted = train ? trains.filter((t) => String(t.train_no) === train) : trains;
  const missingTrain = train && wanted.length === 0;
  if (!missingTrain) trains = wanted;
  if (cls) trains = trains.filter((t) => t.fares.some((f) => f.class === cls));
  const cheapest = Math.min(...trains.flatMap((t) => t.fares.filter((f) => !cls || f.class === cls).map((f) => f.total_fare ?? f.per_adult)));

  return (
    <div className="space-y-4">
      {missingTrain && (
        <div className="rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">
          No fare found for train <b>{train}</b> on {query.from} → {query.to}. It may run the other way.{" "}
          <Link className="font-semibold underline" href={`/live?tab=fare&go=1&from=${query.to}&to=${query.from}&train=${train}&cls=${cls}&quota=${query.quota || "GN"}`}>
            Try {query.to} → {query.from}
          </Link>
          . Showing all trains on this route instead.
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted">
          <span className="font-semibold text-ink">{trains.length}</span> trains · {data.from} → {data.to} · {prettyType(data.quota)} quota
          {cls && <> · {cls}</>}
        </p>
        <p className="text-[11px] text-muted">Indicative fare per adult. Dynamic-fare trains show base fare.</p>
      </div>

      {trains.length === 0 && <p className="rounded-2xl bg-surface p-6 text-sm text-muted">No trains with {cls} class on this route.</p>}

      <ul className="space-y-3">
        {trains.map((t) => (
          <li key={t.train_no} className="min-w-0 rounded-2xl bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <TrainIcon className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold tracking-tight">{t.train_name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted">
                    <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono">#{t.train_no}</span>
                    {t.type && <span className="rounded-md bg-surface-2 px-1.5 py-0.5">{prettyType(t.type)}</span>}
                    {t.distance_km && <span className="rounded-md bg-surface-2 px-1.5 py-0.5">{t.distance_km} km</span>}
                  </div>
                </div>
              </div>
              <Link href={`/live?tab=schedule&go=1&train=${t.train_no}`} className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium hover:text-accent">Schedule</Link>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {t.fares.map((f) => {
                const amount = f.total_fare ?? f.per_adult;
                const picked = !cls || f.class === cls;
                const best = picked && amount === cheapest;
                return (
                  <div key={f.class} className={`min-w-28 shrink-0 rounded-xl px-3 py-2 ${picked ? "bg-accent-soft/60" : "bg-surface-2 opacity-50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{f.class}</span>
                      {best && <span className="rounded bg-accent px-1 text-[9px] font-bold text-accent-ink uppercase">Lowest</span>}
                    </div>
                    <p className="mt-0.5 text-base font-semibold tabular-nums">{inr(amount)}</p>
                    {f.per_child_no_berth != null && <p className="text-[10px] text-muted">Child {inr(f.per_child_no_berth)}</p>}
                    {f.dynamic_fare && <p className="text-[10px] text-warn">Dynamic fare</p>}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
