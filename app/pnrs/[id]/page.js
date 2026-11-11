import Link from "next/link";
import { notFound } from "next/navigation";
import DataView from "@/components/DataView";
import MyBerths from "@/components/MyBerths";
import { refreshTracked, untrack } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getTracked } from "@/lib/pnrs";
import { fmtDateTime } from "@/lib/time";

export const metadata = { title: "PNR" };

export default async function TrackedPnrPage({ params }) {
  const { id } = await params;
  const user = await requireUser(`/pnrs/${id}`);
  const p = await getTracked(user.id, Number(id));
  if (!p) notFound();
  const n = p.normalised;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/bookings" className="text-sm text-muted hover:text-ink">← My bookings</Link>

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-2xl font-semibold">{p.pnr}</p>
            <p className="text-sm text-muted">
              {[p.train_no && `${p.train_no} ${p.train_name || ""}`.trim(), p.from_code && p.to_code && `${p.from_code} → ${p.to_code}`, p.journey_date, p.class_code].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex gap-2">
            <form action={refreshTracked}>
              <input type="hidden" name="id" value={p.id} />
              <button className="btn-primary py-1.5">Refresh now</button>
            </form>
            <form action={untrack}>
              <input type="hidden" name="id" value={p.id} />
              <button className="btn-ghost py-1.5 text-muted">Remove</button>
            </form>
          </div>
        </div>
        {n?.passengers.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs text-muted uppercase">
              <tr><th className="py-2 font-medium">#</th><th className="py-2 font-medium">Booking status</th><th className="py-2 font-medium">Current status</th></tr>
            </thead>
            <tbody>
              {n.passengers.map((x) => (
                <tr key={x.n} className="border-t border-line">
                  <td className="py-2 text-muted">{x.n}</td>
                  <td className="py-2 font-mono">{x.booking || "-"}</td>
                  <td className="py-2 font-mono font-semibold">{x.current || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-muted">
          {p.last_checked_at ? `Last checked ${fmtDateTime(p.last_checked_at)} via ${p.last_provider}` : "Not checked yet"}
          {p.last_error && <span className="text-danger"> · Last error: {p.last_error}</span>}
        </p>
      </div>

      {n?.passengers.length > 0 && (
        <MyBerths
          cls={p.class_code || n.cls}
          passengers={n.passengers}
          names={JSON.parse(p.passenger_names || "{}")}
        />
      )}

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Status history</h2>
        {p.history.length === 0 ? (
          <p className="text-sm text-muted">No snapshots yet.</p>
        ) : (
          <ol className="space-y-2 border-l border-line pl-4">
            {p.history.map((h) => (
              <li key={h.id} className="text-sm">
                <span className={`font-mono ${h.changed ? "font-semibold text-accent" : ""}`}>{h.summary}</span>
                <span className="block text-xs text-muted">{fmtDateTime(h.fetched_at)} · {h.provider}{h.changed ? " · changed" : ""}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {p.last_payload && (
        <details className="card p-5">
          <summary className="cursor-pointer font-semibold">Full provider response</summary>
          <div className="mt-4"><DataView data={JSON.parse(p.last_payload)} /></div>
        </details>
      )}
    </div>
  );
}
