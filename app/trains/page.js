import Link from "next/link";
import SearchForm from "@/components/SearchForm";
import { Availability, Empty, inr } from "@/components/ui";
import { CLASSES, QUOTAS, STATION_MAP } from "@/lib/data";
import { ARP_DAYS, searchTrains } from "@/lib/rail";
import { addDays, fmtClock, fmtDate, fmtDateTime, fmtDuration, isValidDate, todayIST } from "@/lib/time";

export const metadata = { title: "Trains" };

export default async function TrainsPage({ searchParams }) {
  const sp = await searchParams;
  const today = todayIST();
  const from = String(sp.from || "").toUpperCase();
  const to = String(sp.to || "").toUpperCase();
  const date = isValidDate(sp.date) ? sp.date : addDays(today, 1);
  const quota = QUOTAS[sp.quota] ? sp.quota : "GN";
  const results = await searchTrains(from, to, date, quota);
  const qs = (extra) => new URLSearchParams({ from, to, date, quota, ...extra }).toString();

  return (
    <div className="space-y-6">
      <SearchForm initial={{ from: STATION_MAP[from] ? from : "", to: STATION_MAP[to] ? to : "", date, quota }} minDate={today} maxDate={addDays(today, ARP_DAYS + 5)} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">
          {STATION_MAP[from]?.city ?? from} → {STATION_MAP[to]?.city ?? to}
          <span className="ml-2 font-normal text-muted">· {fmtDate(date)} · {QUOTAS[quota]} · {results.length} trains</span>
        </h1>
        <div className="flex gap-2">
          <Link className="btn-ghost py-1.5" href={`/trains?${qs({ date: addDays(date, -1) })}`}>← Prev day</Link>
          <Link className="btn-ghost py-1.5" href={`/trains?${qs({ date: addDays(date, 1) })}`}>Next day →</Link>
        </div>
      </div>

      {results.length === 0 ? (
        <Empty title="No direct trains on this date">Try another date, or swap stations.</Empty>
      ) : (
        <ul className="space-y-4">
          {results.map(({ train, seg, classes }) => (
            <li key={train.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 sm:p-5">
                <div className="min-w-44">
                  <p className="font-semibold">{train.name}</p>
                  <p className="font-mono text-sm text-muted">#{train.number}</p>
                </div>
                <div className="flex flex-1 items-center gap-3">
                  <div>
                    <p className="font-mono text-xl font-semibold">{fmtClock(seg.from.dep)}</p>
                    <p className="text-xs text-muted">{STATION_MAP[seg.from.code].name}</p>
                  </div>
                  <div className="flex flex-1 flex-col items-center text-xs text-muted">
                    <span>{fmtDuration(seg.duration)}</span>
                    <span className="my-1 h-px w-full bg-line" />
                    <span>{seg.km} km</span>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xl font-semibold">{fmtClock(seg.to.arr)}</p>
                    <p className="text-xs text-muted">{STATION_MAP[seg.to.code].name}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap border-t border-line">
                {classes.map((c) => (
                  <Link
                    key={c.code}
                    href={c.closed ? "#" : `/book?${qs({ train: train.id, class: c.code })}`}
                    aria-disabled={c.closed}
                    className={`group -mb-px w-1/2 border-r border-b border-line bg-surface p-3.5 transition sm:w-1/3 lg:w-1/6 ${c.closed ? "pointer-events-none opacity-60" : "hover:bg-surface-2"}`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold">{c.code}</span>
                      <span className="text-sm text-muted">{inr(c.fare)}</span>
                    </div>
                    <p className="text-xs text-muted">{CLASSES[c.code].name}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <Availability c={c} />
                      {!c.closed && (
                        <span className="text-xs font-semibold text-accent opacity-0 transition group-hover:opacity-100">
                          {c.notYetOpen ? "Schedule →" : "Book →"}
                        </span>
                      )}
                    </div>
                    {c.notYetOpen && <p className="mt-1 text-[11px] text-muted">Opens {fmtDateTime(c.opensAt)}</p>}
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
