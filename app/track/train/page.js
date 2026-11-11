import Link from "next/link";
import LiveTracker from "@/components/LiveTracker";
import TrainSearch from "@/components/TrainSearch";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Track a train" };

// Live running status by train number (no PNR needed): /track/train?no=12653&day=0
export default async function TrackTrainPage({ searchParams }) {
  const sp = await searchParams;
  const no = /^\d{5}$/.test(String(sp.no || "")) ? String(sp.no) : "";
  const day = ["0", "1", "2"].includes(String(sp.day)) ? String(sp.day) : "0";
  await requireUser(`/track/train${no ? `?no=${no}&day=${day}` : ""}`);

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-5">
      <Link href="/live" className="text-xs text-muted hover:text-ink sm:text-sm">← Live info</Link>
      <div>
        <h1 className="text-lg font-bold tracking-tight sm:text-2xl">
          {no ? <>Train <span className="font-mono">#{no}</span></> : "Where is my train?"}
        </h1>
        <p className="text-xs text-muted sm:text-sm">
          {no ? (day === "0" ? "Started today" : day === "1" ? "Started yesterday" : "Started 2 days ago") : "Live position by train number. No PNR needed."}
        </p>
      </div>
      <TrainSearch no={no} day={day} compact={Boolean(no)} />
      {no && <LiveTracker key={`${no}-${day}`} trainNo={no} startDay={Number(day)} />}
    </div>
  );
}
