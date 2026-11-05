import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { logout } from "./actions";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  title: { default: "RailGo", template: "%s · RailGo" },
  description: "Search trains, pick berths, add passengers and auto-book the second the window opens.",
};

const NAV = [
  ["/", "Search"],
  ["/bookings", "My bookings"],
  ["/passengers", "Passengers"],
  ["/live", "Live info"],
];

export default async function RootLayout({ children }) {
  const user = await getUser();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-ink">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="5" y="3" width="14" height="14" rx="3" />
                  <path d="M5 11h14M9 17l-2 4M15 17l2 4M9 14h.01M15 14h.01" />
                </svg>
              </span>
              <span className="text-lg">RailGo</span>
            </Link>
            <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto text-sm">
              {NAV.map(([href, label]) => (
                <Link key={href} href={href} className="shrink-0 rounded-lg px-2.5 py-1.5 text-muted hover:bg-surface-2 hover:text-ink">
                  {label}
                </Link>
              ))}
            </nav>
            {user ? (
              <form action={logout} className="flex shrink-0 items-center gap-3 text-sm">
                <span className="hidden text-muted sm:inline">{user.name}</span>
                <button className="btn-ghost py-1.5">Log out</button>
              </form>
            ) : (
              <Link href="/login" className="btn-primary shrink-0 py-1.5">Log in</Link>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-10">{children}</main>
        <footer className="border-t border-line py-6 text-center text-xs text-muted">
          RailGo is an independent demo booking system with simulated trains and inventory. Not affiliated with Indian Railways or IRCTC.
        </footer>
      </body>
    </html>
  );
}
