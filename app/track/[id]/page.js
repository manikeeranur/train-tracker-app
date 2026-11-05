import Link from "next/link";
import { notFound } from "next/navigation";
import LiveTracker from "@/components/LiveTracker";
import { requireUser } from "@/lib/auth";
import { getTracked } from "@/lib/pnrs";
import { currentTime, fmt12, fmtDate, todayIST } from "@/lib/time";

export const metadata = { title: "Track train" };

export default async function TrackPage({ params }) {
  const { id } = await params;
  const user = await requireUser(`/track/${id}`);
  const p = getTracked(user.id, Number(id));
  if (!p) notFound();
  if (!p.train_no) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/bookings" className="text-sm text-muted hover:text-ink">← My bookings</Link>
        <p className="card p-6 text-muted">Train number for this PNR isn&apos;t known yet. Refresh the PNR first.</p>
      </div>
    );
  }

  const today = todayIST(currentTime());
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(p.journey_date || "") ? p.journey_date : null;
  const diff = iso ? Math.round((Date.parse(iso) - Date.parse(today)) / 864e5) : 0;
  // Your run if it's today/yesterday (still en route); otherwise today's run of the same train.
  const ownRun = diff === 0 || diff === -1;
  const startDay = ownRun ? -diff : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/bookings" className="text-sm text-muted hover:text-ink">← My bookings</Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{p.train_name || "Train"} <span className="font-mono text-base font-normal text-muted">#{p.train_no}</span></h1>
          <p className="text-sm text-muted">
            PNR <span className="font-mono text-ink">{p.pnr}</span>
            {p.from_code && p.to_code && <> · {p.from_code} → {p.to_code}</>}
            {iso && <> · {fmtDate(iso)}</>}
            {p.dep_time && <> · {fmt12(p.dep_time)}</>}
          </p>
        </div>
      </div>

      {!ownRun && iso && (
        <p className="rounded-xl bg-info-soft px-4 py-3 text-sm text-info">
          {diff > 0
            ? `Your train runs on ${fmtDate(iso)}. Showing where today's ${p.train_no} is right now.`
            : `Your journey on ${fmtDate(iso)} is over. Showing today's ${p.train_no}.`}
        </p>
      )}

      <LiveTracker
        trainNo={p.train_no}
        startDay={startDay}
        board={p.boarding_code || p.from_code}
        boardName={p.boarding_name || p.from_name}
        dest={p.to_code}
        destName={p.to_name}
      />
    </div>
  );
}
