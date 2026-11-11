import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import PwaRegister from "@/components/PwaRegister";
import { getUser } from "@/lib/auth";
import { logout } from "./actions";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  title: { default: "RailGo", template: "%s · RailGo" },
  description: "Search trains, pick berths, add passengers and auto-book the second the window opens.",
  applicationName: "RailGo",
  appleWebApp: { capable: true, title: "RailGo", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1215" },
  ],
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
        <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-192.png" alt="" width={32} height={32} className="size-8 rounded-lg" />
              <span className="text-lg">RailGo</span>
            </Link>
            <div className="flex-1 sm:hidden" />
            <nav className="-mx-1 hidden flex-1 gap-1 overflow-x-auto text-sm sm:flex">
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
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:py-10">{children}</main>
        <footer className="hidden border-t border-line py-6 text-center text-xs text-muted sm:block">
          RailGo is an independent demo booking system with simulated trains and inventory. Not affiliated with Indian Railways or IRCTC.
        </footer>
        <BottomNav />
        <PwaRegister />
      </body>
    </html>
  );
}
