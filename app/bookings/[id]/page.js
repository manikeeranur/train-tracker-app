import Link from "next/link";
import { notFound } from "next/navigation";
import Countdown from "@/components/Countdown";
import Ticket from "@/components/Ticket";
import { cancel, runScheduledNow } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getBooking } from "@/lib/booking";
import { fmtDateTime } from "@/lib/time";

export const metadata = { title: "Booking" };

export default async function BookingPage({ params }) {
  const { id } = await params;
  const user = await requireUser(`/bookings/${id}`);
  const b = await getBooking(user.id, Number(id));
  if (!b) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/bookings" className="text-sm text-muted hover:text-ink">← All bookings</Link>

      {b.status === "SCHEDULED" && (
        <div className="card space-y-4 border-info/40 bg-info-soft p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-info">Auto-book armed</p>
              <p className="text-sm text-muted">Fires at {fmtDateTime(b.scheduled_for)}. Keep this page open to watch it happen, or come back later.</p>
            </div>
            <Countdown target={b.scheduled_for} refreshOnZero className="text-3xl font-semibold text-info" />
          </div>
          <form action={runScheduledNow} className="flex flex-wrap items-center gap-3 border-t border-info/20 pt-4">
            <input type="hidden" name="id" value={b.id} />
            <button className="btn-ghost py-1.5">Simulate window open now</button>
            <span className="text-xs text-muted">Demo: runs the auto-book immediately instead of waiting.</span>
          </form>
        </div>
      )}

      {b.status !== "SCHEDULED" && b.booked_at && b.scheduled_for && b.attempt_ms != null && b.status !== "FAILED" && (
        <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
          Booked at {fmtDateTime(b.booked_at)}{b.attempt_ms > 0 ? `, ${b.attempt_ms} ms after the window opened` : ""}.
        </p>
      )}
      {b.note && (
        <p className={`rounded-xl px-4 py-3 text-sm ${b.status === "FAILED" ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted"}`}>{b.note}</p>
      )}

      <Ticket b={b} />

      {["SCHEDULED", "CONFIRMED", "WAITLIST"].includes(b.status) && (
        <form action={cancel} className="flex justify-end">
          <input type="hidden" name="id" value={b.id} />
          <button className="btn-danger">{b.status === "SCHEDULED" ? "Cancel auto-book" : "Cancel ticket"}</button>
        </form>
      )}
    </div>
  );
}
