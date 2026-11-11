import Link from "next/link";

// Icon per live tool (24×24, stroke).
const ICONS = {
  running: <><rect x="6" y="3" width="12" height="13" rx="3" /><path d="M6 10h12M9 20l-2 2M15 20l2 2M9 13h.01M15 13h.01" /><path d="M2 21h20" opacity=".5" /></>,
  pnr: <><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5Z" /><path d="M9 9h6M9 12h6M9 15h3" /></>,
  between: <><circle cx="5" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /><path d="M7.5 12h9M13 8.5 16.5 12 13 15.5" /></>,
  fare: <><path d="M7 5h10M7 9h10M7 5c5 0 5 8 0 8l7 6" /></>,
  schedule: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  station: <><path d="M4 21V9l8-5 8 5v12" /><path d="M9 21v-6h6v6M4 21h16" /></>,
};

export const TOOL_INFO = {
  running: { title: "Live running status", short: "Live status", desc: "Where is your train right now: position, delay and route." },
  pnr: { title: "PNR status", short: "PNR", desc: "Booking and current status for every passenger on a 10-digit PNR." },
  between: { title: "Trains between stations", short: "Trains between", desc: "All trains between two stations, with seat availability for a date." },
  fare: { title: "Fare", short: "Fare", desc: "Ticket fares by class and quota between two stations." },
  schedule: { title: "Train schedule", short: "Schedule", desc: "Full timetable: every stop, arrival, departure and distance." },
  station: { title: "Live station", short: "Live station", desc: "Trains arriving at and leaving a station in the next few hours." },
};

export function ToolIcon({ k, className = "size-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[k]}
    </svg>
  );
}

/** 3×2 grid of tools (no sideways scrolling on phones). */
export function ToolGrid({ tabs, active }) {
  return (
    <nav className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Live tools">
      {tabs.map((k) => {
        const on = k === active;
        return (
          <Link
            key={k}
            href={`/live?tab=${k}`}
            aria-current={on ? "page" : undefined}
            className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center text-[11px] font-semibold transition sm:text-xs ${
              on ? "bg-accent text-accent-ink shadow-sm" : "bg-surface text-muted ring-1 ring-line hover:text-ink"
            }`}
          >
            <span className={`grid size-9 place-items-center rounded-xl ${on ? "bg-white/15" : "bg-accent-soft text-accent"}`}>
              <ToolIcon k={k} />
            </span>
            {TOOL_INFO[k]?.short}
          </Link>
        );
      })}
    </nav>
  );
}

/** Title row above a tool's form. */
export function ToolHeader({ k }) {
  const t = TOOL_INFO[k];
  if (!t) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
        <ToolIcon k={k} className="size-5" />
      </span>
      <div>
        <h2 className="font-semibold tracking-tight">{t.title}</h2>
        <p className="text-xs text-muted sm:text-sm">{t.desc}</p>
      </div>
    </div>
  );
}
