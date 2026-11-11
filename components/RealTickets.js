import Link from "next/link";
import AutoSync from "./AutoSync";
import { DeleteCompleted } from "./DeleteTicket";
import PnrImport from "./PnrImport";
import TicketCard from "./TicketCard";
import TrainArt from "./TrainArt";
import TrainIcon from "./TrainIcon";
import { many } from "@/lib/db";
import { isConfigured } from "@/lib/live";
import { apiUsage, isCompleted, listTracked, staleIds } from "@/lib/pnrs";
import { currentTime, fmt12, fmtDate, todayIST } from "@/lib/time";

export default async function RealTickets({ userId, add = "", tab = "upcoming" }) {
  const now = currentTime();
  const today = todayIST(now);
  const all = await listTracked(userId);
  const [stale, usage, savedNames] = await Promise.all([
    staleIds(userId).then((ids) => ids.length),
    apiUsage(),
    many("passengers", { user_id: userId }, { sort: { name: 1 }, projection: { name: 1 } }).then((rows) => rows.map((r) => r.name)),
  ]);

  const byDate = (a, b) => (a.journey_date || "9999").localeCompare(b.journey_date || "9999") || (a.dep_time || "").localeCompare(b.dep_time || "");
  const upcoming = all.filter((p) => !isCompleted(p, now)).sort(byDate);
  const past = all.filter((p) => isCompleted(p, now)).sort((a, b) => byDate(b, a));
  const next = upcoming.find((p) => p.journey_date);
  const thisMonth = upcoming.filter((p) => p.journey_date?.slice(0, 7) === today.slice(0, 7)).length;

  return (
    <div className="space-y-5 sm:space-y-8">
      <datalist id="saved-passenger-names">
        {savedNames.map((n) => <option key={n} value={n} />)}
      </datalist>
      {/* Summary */}
      {all.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="card relative overflow-hidden bg-gradient-to-br from-accent-soft/70 to-surface p-4 pb-16 sm:col-span-2 sm:p-5 sm:pr-56 sm:pb-5">
            <TrainArt className="absolute right-3 bottom-2 w-48 sm:right-4 sm:bottom-3 sm:w-52" />
            <p className="text-[11px] font-medium tracking-wide text-muted uppercase sm:text-xs">Next trip</p>
            {next ? (
              <>
                <p className="mt-1 truncate text-base font-semibold tracking-tight sm:text-xl">
                  {next.from_code} → {next.to_code} <span className="font-normal text-muted">· {next.train_name}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted sm:mt-1 sm:text-sm">
                  {fmtDate(next.journey_date)} at <span className="text-ink">{fmt12(next.dep_time)}</span>
                  {next.boarding_name && ` from ${next.boarding_name}`}
                </p>
              </>
            ) : (
              <p className="mt-1 text-muted">No upcoming trips</p>
            )}
          </div>
          <div className="card grid grid-cols-[auto_auto_1fr] items-center gap-x-5 gap-y-2 p-4 sm:grid-cols-2 sm:p-5">
            <div>
              <p className="text-xl font-semibold tabular-nums sm:text-3xl">{upcoming.length}</p>
              <p className="text-xs text-muted">Upcoming</p>
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums sm:text-3xl">{thisMonth}</p>
              <p className="text-xs text-muted">This month</p>
            </div>
            <div className="justify-self-end sm:col-span-2 sm:mt-1 sm:justify-self-start">{isConfigured() && <AutoSync stale={stale} />}</div>
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
        <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-[15px] font-semibold sm:text-base">
          <span>+ Add tickets from IRCTC</span>
          <span className="hidden text-sm font-normal text-muted group-open:hidden sm:inline">Paste PNRs or Booked Ticket History</span>
        </summary>
        <div className="border-t border-line p-4 pt-3">
          <PnrImport prefill={/^\d{10}$/.test(add) ? add : ""} />
        </div>
      </details>

      {all.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent"><TrainIcon className="size-10" /></span>
          <p className="font-semibold">No tickets yet</p>
          <p className="max-w-sm text-sm text-muted">Open IRCTC → My Bookings, copy the list and paste it above. Every ticket appears here with live passenger status.</p>
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav className="inline-flex rounded-xl bg-surface-2 p-1 text-sm" aria-label="Journeys">
              {[
                ["upcoming", "Upcoming", upcoming.length],
                ["completed", "Completed", past.length],
              ].map(([key, label, count]) => (
                <Link
                  key={key}
                  href={key === "upcoming" ? "/bookings" : "/bookings?tab=completed"}
                  aria-current={tab === key ? "page" : undefined}
                  className={`rounded-lg px-3.5 py-1.5 font-medium transition ${tab === key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
                >
                  {label} <span className="tabular-nums opacity-70">{count}</span>
                </Link>
              ))}
            </nav>
            {tab === "completed" && past.length > 0 && <DeleteCompleted count={past.length} />}
          </div>
          {tab === "upcoming" ? (
            upcoming.length === 0 ? (
              <p className="card px-5 py-8 text-center text-sm text-muted">No upcoming trips.</p>
            ) : (
              <div className="space-y-4">
                {upcoming.map((p) => <TicketCard key={p.id} p={p} now={now} />)}
              </div>
            )
          ) : past.length === 0 ? (
            <p className="card px-5 py-8 text-center text-sm text-muted">No completed journeys yet.</p>
          ) : (
            <div className="space-y-4">
              {past.map((p) => <TicketCard key={p.id} p={p} now={now} past />)}
            </div>
          )}
        </section>
      )}

      {usage.length > 0 && (
        <p className="text-xs text-muted">API calls this month: {usage.map((u) => `${u.provider} ${u.calls}`).join(" · ")}</p>
      )}
    </div>
  );
}
