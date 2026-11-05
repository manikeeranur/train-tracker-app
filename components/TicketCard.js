import Link from "next/link";
import { refreshTracked } from "@/app/actions";
import { normalisePnr } from "@/lib/pnrs";
import { fmt12 } from "@/lib/time";
import LiveStrip from "./LiveStrip";
import TrainIcon from "./TrainIcon";
import { inr } from "./ui";

// Visual tone for an IRCTC status string.
export function statusTone(s) {
  const v = String(s || "");
  if (/CAN/i.test(v)) return { fg: "text-muted", bg: "bg-surface-2", bar: "bg-line", label: "Cancelled" };
  if (/WL|W\/L/i.test(v)) return { fg: "text-warn", bg: "bg-warn-soft", bar: "bg-warn", label: "Waitlist" };
  if (/RAC/i.test(v)) return { fg: "text-info", bg: "bg-info-soft", bar: "bg-info", label: "RAC" };
  if (/CNF|CONFIRM/i.test(v)) return { fg: "text-accent", bg: "bg-accent-soft", bar: "bg-accent", label: "Confirmed" };
  if (/BOOKED/i.test(v)) return { fg: "text-accent", bg: "bg-accent-soft", bar: "bg-accent", label: "Booked" };
  return { fg: "text-muted", bg: "bg-surface-2", bar: "bg-line", label: "Status pending" };
}

function relDay(dateStr, now) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const today = new Date(now + 330 * 60000).toISOString().slice(0, 10);
  const days = Math.round((Date.parse(dateStr) - Date.parse(today)) / 864e5);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  if (days === -1) return "Yesterday";
  return `${-days} days ago`;
}

function ago(ms, now) {
  const m = Math.round((now - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}


export default function TicketCard({ p, now, past = false }) {
  const n = p.last_payload ? normalisePnr(JSON.parse(p.last_payload)) : null;
  const pax = n?.passengers ?? [];
  const overall = pax.length ? pax.map((x) => x.current).join(" ") : p.booking_status;
  const tone = statusTone(overall);
  const rel = relDay(p.journey_date, now);

  const d = p.journey_date && /^\d{4}-\d{2}-\d{2}$/.test(p.journey_date) ? new Date(`${p.journey_date}T00:00:00Z`) : null;
  const nextDay = d && /^\d{4}-\d{2}-\d{2}$/.test(p.arrival_date || "") ? Math.round((Date.parse(p.arrival_date) - d.getTime()) / 864e5) : 0;

  // Live tracking only while the train can actually be running: travel day, or still en route next day.
  const today = new Date(now + 330 * 60000).toISOString().slice(0, 10);
  const dayDiff = d ? Math.round((d.getTime() - Date.parse(today)) / 864e5) : null;
  const showLive = !past && p.train_no && (dayDiff === 0 || (dayDiff === -1 && (p.arrival_date || "") >= today));
  const tint = past ? "bg-surface-2 text-muted" : `${tone.bg} ${tone.fg}`;
  const meta = [p.class_code, n?.quota, n?.fare != null && inr(n.fare)].filter(Boolean);

  return (
    <article className={`group flex flex-col overflow-hidden rounded-3xl bg-surface sm:flex-row ${past ? "opacity-75" : ""}`}>
      {/* Stub: date, tinted by status */}
      <div className={`flex items-center justify-between gap-3 px-5 py-3 sm:w-32 sm:shrink-0 sm:flex-col sm:justify-center sm:py-5 sm:text-center ${tint}`}>
        <div className="flex items-baseline gap-2 sm:flex-col sm:items-center sm:gap-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-80">
            {d ? d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }) : ""}
          </p>
          <p className="text-4xl leading-none font-bold tracking-tight tabular-nums sm:my-1">{d ? d.getUTCDate() : "—"}</p>
          <p className="text-sm font-semibold tracking-wide uppercase">
            {d ? d.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }) : ""}
          </p>
        </div>
        {rel && <span className="rounded-full bg-surface/70 px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-ink sm:mt-2">{rel}</span>}
      </div>

      {/* Perforation */}
      <div className="relative hidden w-0 sm:block" aria-hidden>
        <span className="absolute -top-2.5 -left-2.5 size-5 rounded-full bg-bg" />
        <span className="absolute inset-y-3 left-0 border-l-2 border-dashed border-line" />
        <span className="absolute -bottom-2.5 -left-2.5 size-5 rounded-full bg-bg" />
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1 space-y-4 p-5">
        {/* Train + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/pnrs/${p.id}`} className="flex items-center gap-2 font-semibold tracking-tight hover:text-accent">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                <TrainIcon className="size-5" />
              </span>
              <span className="truncate">{p.train_name || "Train details pending"}</span>
            </Link>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium text-muted">
              {p.train_no && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono">#{p.train_no}</span>}
              {meta.map((m) => <span key={m} className="rounded-md bg-surface-2 px-1.5 py-0.5">{m}</span>)}
              {p.label && <span className="rounded-md bg-surface-2 px-1.5 py-0.5">{p.label}</span>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className={`chip ${tone.bg} ${tone.fg}`}>{tone.label}</span>
            {!past && p.train_no && (
              <Link href={`/track/${p.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-3 py-1 text-xs font-semibold text-info transition hover:brightness-95">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-info opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-info" />
                </span>
                Track train
              </Link>
            )}
            {showLive && <LiveStrip trainNo={p.train_no} startDay={-dayDiff} />}
          </div>
        </div>

        {/* Route */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(80px,1.2fr)_minmax(0,1fr)] items-center gap-3">
          <div className="min-w-0">
            <p className="text-xl font-bold tracking-tight whitespace-nowrap tabular-nums">{p.dep_time ? fmt12(p.dep_time) : "--:--"}</p>
            <p className="truncate text-sm"><span className="font-semibold">{p.from_code || "—"}</span> <span className="hidden text-muted sm:inline">{p.from_name}</span></p>
          </div>
          <div className="flex flex-col items-center gap-1 text-[11px] text-muted">
            <span className="font-medium">{p.duration || ""}</span>
            <div className="flex w-full items-center">
              <span className="size-2 rounded-full border-2 border-accent" />
              <span className="flex-1 border-t-2 border-dotted border-line" />
              <TrainIcon className="mx-1 size-4 text-accent" />
              <span className="flex-1 border-t-2 border-dotted border-line" />
              <span className="size-2 rounded-full bg-accent" />
            </div>
            {p.boarding_code && p.boarding_code !== p.from_code ? <span>Board at {p.boarding_code}</span> : <span className="invisible">.</span>}
          </div>
          <div className="min-w-0 text-right">
            <p className="text-xl font-bold tracking-tight whitespace-nowrap tabular-nums">
              {p.arr_time ? fmt12(p.arr_time) : "--:--"}
              {nextDay > 0 && <sup className="ml-0.5 text-[10px] font-semibold text-muted" title={`Arrives ${p.arrival_date}`}>+{nextDay}</sup>}
            </p>
            <p className="truncate text-sm"><span className="hidden text-muted sm:inline">{p.to_name}</span> <span className="font-semibold">{p.to_code || "—"}</span></p>
          </div>
        </div>


        {/* Passengers + PNR */}
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line/70 pt-3">
          {pax.length > 0 ? (
            <ul className="flex min-w-0 flex-wrap gap-2">
              {pax.map((x) => {
                const t = statusTone(x.current || x.booking);
                const [st, ...rest] = String(x.current || x.booking || "").split("/");
                return (
                  <li key={x.n} className="flex items-center gap-2 rounded-xl bg-surface-2 py-1 pr-1 pl-2.5 text-sm">
                    <span className="text-xs font-semibold text-muted">P{x.n}</span>
                    <span className={`rounded-lg px-2 py-0.5 font-mono text-xs font-semibold ${t.bg} ${t.fg}`} title={x.booking ? `Booked ${x.booking}` : ""}>
                      {st}{rest.length > 0 && <span className="font-normal"> {rest.join(" · ")}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted">{p.last_error ? `Status unavailable: ${p.last_error}` : "Passenger status loading…"}</p>
          )}
          <form action={refreshTracked} className="ml-auto flex items-center gap-2 text-xs text-muted">
            <input type="hidden" name="id" value={p.id} />
            <span>
              PNR <span className="font-mono font-semibold text-ink">{p.pnr}</span>
              {n?.chartText && <span className={n.chartPrepared === 1 ? "text-accent" : ""}> · {n.chartText}</span>}
              {p.last_checked_at && <span> · {ago(p.last_checked_at, now)}</span>}
            </span>
            <button className="grid size-7 place-items-center rounded-lg text-sm transition hover:bg-surface-2 hover:text-ink" aria-label={`Refresh PNR ${p.pnr}`} title="Refresh status">↻</button>
          </form>
        </div>
      </div>
    </article>
  );
}
