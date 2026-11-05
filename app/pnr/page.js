import Ticket from "@/components/Ticket";
import { Empty } from "@/components/ui";
import { findByPnr } from "@/lib/booking";

export const metadata = { title: "PNR status" };

export default async function PnrPage({ searchParams }) {
  const { pnr = "" } = await searchParams;
  const clean = String(pnr).replace(/\D/g, "").slice(0, 10);
  const b = clean.length === 10 ? findByPnr(clean) : null;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">PNR status</h1>
      <form className="card flex flex-col gap-3 p-4 sm:flex-row">
        <input name="pnr" defaultValue={clean} inputMode="numeric" pattern="\d{10}" maxLength={10} placeholder="10-digit PNR" className="field font-mono text-lg" required />
        <button className="btn-primary px-6">Check status</button>
      </form>
      {clean && !b && <Empty title="PNR not found">Check the number and try again.</Empty>}
      {b && <Ticket b={b} showPrivate={false} />}
    </div>
  );
}
