"use client";

import { useState } from "react";
import MyBerths from "./MyBerths";
import Sheet from "./Sheet";
import { layoutFor } from "@/lib/berth";

/** Seat icon on a ticket card: opens the 3D coach view in a sheet. */
export default function SeatButton({ cls, passengers, names, coach, large = false }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`grid place-items-center text-accent transition hover:bg-accent-soft ${large ? "size-9 rounded-full" : "size-7 rounded-lg"}`}
        aria-label="See your seat in 3D"
        title="See your berth"
      >
        {/* reclining seat */}
        <svg viewBox="0 0 24 24" className={large ? "size-5" : "size-4"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 4l2 9h7l2 5" />
          <path d="M8 13l-1 5h3" />
          <path d="M10 9h5" />
          <circle cx="6.5" cy="3.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <Sheet tall open={open} onClose={() => setOpen(false)} title={`Your ${layoutFor(cls) ? "berth" : "seat"}${coach ? ` · Coach ${coach}` : ""}`}>
        {open && <MyBerths cls={cls} passengers={passengers} names={names} heading={false} fill />}
      </Sheet>
    </>
  );
}
