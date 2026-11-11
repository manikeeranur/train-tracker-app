import Link from "next/link";
import { notFound } from "next/navigation";
import BookingForm from "@/components/BookingForm";
import { Availability, inr } from "@/components/ui";
import { CLASSES, QUOTAS, STATION_MAP } from "@/lib/data";
import { requireUser } from "@/lib/auth";
import { MAX_PASSENGERS } from "@/lib/booking";
import { many } from "@/lib/db";
import { availability, bookingWindow, fareFor, getTrain, originDate, runsOn, segment } from "@/lib/rail";
import { currentTime, fmtClock, fmtDate, fmtDateTime, fmtDuration, isValidDate } from "@/lib/time";

export const metadata = { title: "Book" };

export default async function BookPage({ searchParams }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(sp).toString();
  const user = await requireUser(`/book?${qs}`);

  const train = getTrain(String(sp.train));
  const classCode = String(sp.class);
  const quota = QUOTAS[sp.quota] ? sp.quota : "GN";
  const date = String(sp.date);
  if (!train || !train.classes[classCode] || !isValidDate(date)) notFound();
  const seg = segment(train, String(sp.from), String(sp.to));
  if (!seg || !runsOn(train, date, seg.from)) notFound();

  const now = currentTime();
  const win = bookingWindow(train, date, seg.from.code, classCode, quota);
  const av = await availability(train, originDate(date, seg.from), classCode, quota, now);
  const c = { ...av, closed: now >= win.closesAt, notYetOpen: now < win.opensAt };
  const saved = await many("passengers", { user_id: user.id }, {
    sort: { name: 1 }, projection: { id: 1, name: 1, age: 1, gender: 1, berth_pref: 1 },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Link href={`/trains?from=${seg.from.code}&to=${seg.to.code}&date=${date}&quota=${quota}`} className="text-sm text-muted hover:text-ink">
          ← Back to trains
        </Link>
        <BookingForm
          hidden={{ train: train.id, date, from: seg.from.code, to: seg.to.code, class: classCode, quota }}
          saved={saved}
          maxPassengers={MAX_PASSENGERS[quota]}
          pattern={[...new Set(CLASSES[classCode].pattern)]}
          fares={{
            adult: fareFor(train, classCode, quota, seg.km, 30),
            child: fareFor(train, classCode, quota, seg.km, 8),
          }}
          scheduled={c.notYetOpen}
          closed={c.closed}
          opensAt={win.opensAt}
          opensLabel={fmtDateTime(win.opensAt)}
        />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="card p-5">
          <p className="font-semibold">{train.name} <span className="font-mono text-sm font-normal text-muted">#{train.number}</span></p>
          <p className="mt-1 text-sm text-muted">{fmtDate(date)} · {CLASSES[classCode].name} ({classCode}) · {QUOTAS[quota]}</p>
          <div className="mt-4 flex items-center gap-3">
            <div>
              <p className="font-mono text-lg font-semibold">{fmtClock(seg.from.dep)}</p>
              <p className="text-xs text-muted">{STATION_MAP[seg.from.code].name}</p>
            </div>
            <div className="flex-1 text-center text-xs text-muted">{fmtDuration(seg.duration)}</div>
            <div className="text-right">
              <p className="font-mono text-lg font-semibold">{fmtClock(seg.to.arr)}</p>
              <p className="text-xs text-muted">{STATION_MAP[seg.to.code].name}</p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Availability</dt><dd><Availability c={c} /></dd></div>
            <div className="flex justify-between"><dt className="text-muted">Fare / adult</dt><dd>{inr(fareFor(train, classCode, quota, seg.km, 30))}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Window opens</dt><dd className="text-right">{fmtDateTime(win.opensAt)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Window closes</dt><dd className="text-right">{fmtDateTime(win.closesAt)}</dd></div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
