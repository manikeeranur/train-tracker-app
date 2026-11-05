import Link from "next/link";
import SearchForm from "@/components/SearchForm";
import { ARP_DAYS } from "@/lib/rail";
import { addDays, todayIST } from "@/lib/time";

const POPULAR = [
  ["MS", "MDU", "Chennai → Madurai"],
  ["MAS", "CBE", "Chennai → Coimbatore"],
  ["MAS", "SBC", "Chennai → Bengaluru"],
  ["MS", "TEN", "Chennai → Tirunelveli"],
  ["MAS", "ERS", "Chennai → Kochi"],
  ["MAS", "NDLS", "Chennai → Delhi"],
];

export default function Home() {
  const today = todayIST();
  const tomorrow = addDays(today, 1);
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
          Pick the train. Add passengers. <span className="text-accent">We book it the second it opens.</span>
        </h1>
        <p className="max-w-xl text-muted">
          Schedule an auto-booking for any train before its window opens. RailGo allocates your berths the moment General
          ({ARP_DAYS} days ahead, 08:00) or Tatkal (10:00 AC / 11:00 non-AC) booking starts.
        </p>
      </section>

      <SearchForm initial={{ date: tomorrow, quota: "GN" }} minDate={today} maxDate={addDays(today, ARP_DAYS + 5)} />

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["1", "Choose train & class", "Live availability per class, fares and timings."],
          ["2", "Berths & passengers", "Pick from your saved passengers with berth preferences."],
          ["3", "Auto-book", "Window not open yet? We fire your booking at the exact second."],
        ].map(([n, t, d]) => (
          <div key={n} className="card p-5">
            <span className="font-mono text-sm text-accent">0{n}</span>
            <p className="mt-2 font-semibold">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted uppercase">Popular routes</h2>
        <div className="flex flex-wrap gap-2">
          {POPULAR.map(([f, t, l]) => (
            <Link key={l} href={`/trains?from=${f}&to=${t}&date=${tomorrow}&quota=GN`} className="btn-ghost">
              {l}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
