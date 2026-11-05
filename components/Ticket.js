import { PaxStatus, StatusBadge, inr } from "./ui";
import { CLASSES, QUOTAS, STATION_MAP, TRAIN_MAP } from "@/lib/data";
import { segment } from "@/lib/rail";
import { fmtClock, fmtDate, fmtDuration } from "@/lib/time";

const GENDER = { M: "Male", F: "Female", T: "Transgender" };

export default function Ticket({ b, showPrivate = true }) {
  const t = TRAIN_MAP[b.train_id];
  const seg = segment(t, b.from_code, b.to_code);
  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2 px-5 py-4">
        <div>
          <p className="font-semibold">{t.name} <span className="font-mono text-sm font-normal text-muted">#{t.number}</span></p>
          <p className="text-sm text-muted">{CLASSES[b.class_code].name} ({b.class_code}) · {QUOTAS[b.quota]} quota</p>
        </div>
        <div className="text-right">
          <StatusBadge status={b.status} />
          <p className="mt-1 font-mono text-sm">{b.pnr ? `PNR ${b.pnr}` : "PNR on booking"}</p>
        </div>
      </header>
      <div className="flex items-center gap-4 px-5 py-5">
        <div>
          <p className="font-mono text-2xl font-semibold">{fmtClock(seg.from.dep)}</p>
          <p className="text-sm">{STATION_MAP[b.from_code].name}</p>
          <p className="text-xs text-muted">{fmtDate(b.journey_date)}</p>
        </div>
        <div className="flex flex-1 flex-col items-center text-xs text-muted">
          <span>{fmtDuration(seg.duration)}</span>
          <span className="my-1 h-px w-full border-t border-dashed border-line" />
          <span>{seg.km} km</span>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-semibold">{fmtClock(seg.to.arr)}</p>
          <p className="text-sm">{STATION_MAP[b.to_code].name}</p>
        </div>
      </div>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-xs text-muted uppercase">
            <tr>
              <th className="px-5 py-3 font-medium">#</th>
              <th className="px-2 py-3 font-medium">Passenger</th>
              <th className="px-2 py-3 font-medium">Pref.</th>
              <th className="px-2 py-3 font-medium">Status</th>
              {showPrivate && <th className="px-5 py-3 text-right font-medium">Fare</th>}
            </tr>
          </thead>
          <tbody>
            {b.passengers.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-5 py-3 text-muted">{p.seq}</td>
                <td className="px-2 py-3">
                  {showPrivate ? p.name : `Passenger ${p.seq}`}
                  <span className="ml-2 text-muted">{p.age} · {GENDER[p.gender]}</span>
                </td>
                <td className="px-2 py-3 text-muted">{p.berth_pref}</td>
                <td className="px-2 py-3"><PaxStatus p={p} /></td>
                {showPrivate && <td className="px-5 py-3 text-right">{inr(p.fare)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showPrivate && (
        <footer className="flex justify-between border-t border-line px-5 py-4">
          <span className="text-muted">Total fare</span>
          <span className="font-semibold">{inr(b.fare_total)}</span>
        </footer>
      )}
    </article>
  );
}
