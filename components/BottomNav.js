"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  ticket: <><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5Z" /><path d="M14 5v14" strokeDasharray="2 2.2" /></>,
  people: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14a5.5 5.5 0 0 1 3 5" /></>,
  live: <><circle cx="12" cy="12" r="2.2" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" /></>,
};

const TABS = [
  ["/", "Search", "search"],
  ["/bookings", "Bookings", "ticket"],
  ["/passengers", "Passengers", "people"],
  ["/live", "Live", "live"],
];

function isActive(path, href) {
  if (href === "/") return path === "/" || path.startsWith("/trains") || (path.startsWith("/book") && !path.startsWith("/bookings"));
  if (href === "/bookings") return path.startsWith("/bookings") || path.startsWith("/pnrs") || path.startsWith("/track");
  return path.startsWith(href);
}

/** App-style tab bar on phones (the header nav is hidden there). */
export default function BottomNav() {
  const path = usePathname() || "/";
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main"
    >
      <ul className="grid grid-cols-4">
        {TABS.map(([href, label, icon]) => {
          const active = isActive(path, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}
              >
                <span className={`grid h-7 w-12 place-items-center rounded-full transition ${active ? "bg-accent-soft" : ""}`}>
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {ICONS[icon]}
                  </svg>
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
