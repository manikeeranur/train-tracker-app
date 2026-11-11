import Link from "next/link";
import AutoSync from "./AutoSync";
import PnrImport from "./PnrImport";
import TicketCard from "./TicketCard";
import TrainIcon from "./TrainIcon";
import { many } from "@/lib/db";
import { isConfigured } from "@/lib/live";
import { apiUsage, listTracked, staleIds } from "@/lib/pnrs";
import { currentTime, fmt12, fmtDate, todayIST } from "@/lib/time";

export default async function RealTickets({ userId, add = "" }) {
  const now = currentTime();
  const today = todayIST(now);
  const all = await listTracked(userId);
  const [stale, usage, savedNames] = await Promise.all([
    staleIds(userId).then((ids) => ids.length),
    apiUsage(),
    many("passengers", { user_id: userId }, { sort: { name: 1 }, projection: { name: 1 } }).then((rows) => rows.map((r) => r.name)),
  ]);

  const isPast = (p) => p.journey_date && /^\d{4}-\d{2}-\d{2}$/.test(p.journey_date) && (p.arrival_date || p.journey_date) < today;
  const byDate = (a, b) => (a.journey_date || "9999").localeCompare(b.journey_date || "9999") || (a.dep_time || "").localeCompare(b.dep_time || "");
  const upcoming = all.filter((p) => !isPast(p)).sort(byDate);
  const past = all.filter(isPast).sort((a, b) => byDate(b, a));
  const next = upcoming.find((p) => p.journey_date);
  const thisMonth = upcoming.filter((p) => p.journey_date?.slice(0, 7) === today.slice(0, 7)).length;

  return (
    <div className="space-y-8">
      <datalist id="saved-passenger-names">
        {savedNames.map((n) => <option key={n} value={n} />)}
      </datalist>
      {/* Summary */}
      {all.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="card relative overflow-hidden p-5 sm:col-span-2">
            <TrainIcon className="absolute -right-4 -bottom-6 size-36 text-accent opacity-10" />
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Next trip</p>
            {next ? (
              <>
                <p className="mt-1 text-xl font-semibold tracking-tight">
                  {next.from_code} → {next.to_code} <span className="font-normal text-muted">· {next.train_name}</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  {fmtDate(next.journey_date)} at <span className="text-ink">{fmt12(next.dep_time)}</span>
                  {next.boarding_name && ` from ${next.boarding_name}`}
                </p>
              </>
            ) : (
              <p className="mt-1 text-muted">No upcoming trips</p>
            )}
          </div>
          <div className="card grid grid-cols-2 gap-2 p-5">
            <div>
              <p className="text-3xl font-semibold tabular-nums">{upcoming.length}</p>
              <p className="text-xs text-muted">Upcoming</p>
            </div>
            <div>
              <p className="text-3xl font-semibold tabular-nums">{thisMonth}</p>
              <p className="text-xs text-muted">This month</p>
            </div>
            <div className="col-span-2 mt-1">{isConfigured() && <AutoSync stale={stale} />}</div>
          </div>
        </section>
      )}

      {!isConfigured() && (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          RAIL_API_KEY is not set, so passenger status can&apos;t load. See <Link href="/live" className="underline">Live info</Link>.
        </p>
      )}

      {/* Add tickets */}
      <details className="group card" open={all.length === 0 || !!add}>
        <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-semibold">
          <span>+ Add tickets from IRCTC</span>
          <span className="text-sm font-normal text-muted group-open:hidden">Paste PNRs or Booked Ticket History</span>
        </summary>
        <div className="border-t border-line p-4 pt-3">
          <PnrImport prefill={/^\d{10}$/.test(add) ? add : ""} />
        </div>
      </details>

      {/* Upcoming */}
      {all.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent"><TrainIcon className="size-10" /></span>
          <p className="font-semibold">No tickets yet</p>
          <p className="max-w-sm text-sm text-muted">Open IRCTC → My Bookings, copy the list and paste it above. Every ticket appears here with live passenger status.</p>
        </div>
      ) : (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Upcoming · {upcoming.length}</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted">No upcoming trips.</p>
          ) : (
            <div className="space-y-4">
              {upcoming.map((p) => <TicketCard key={p.id} p={p} now={now} />)}
            </div>
          )}
        </section>
      )}

      {past.length > 0 && (
        <details className="space-y-4">
          <summary className="cursor-pointer text-sm font-semibold tracking-wide text-muted uppercase">Completed · {past.length}</summary>
          <div className="mt-4 space-y-4">
            {past.map((p) => <TicketCard key={p.id} p={p} now={now} past />)}
          </div>
        </details>
      )}

      {usage.length > 0 && (
        <p className="text-xs text-muted">API calls this month: {usage.map((u) => `${u.provider} ${u.calls}`).join(" · ")}</p>
      )}
    </div>
  );
}
