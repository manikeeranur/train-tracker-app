// Starts the auto-booking scheduler once per server process.
// Every second it books all SCHEDULED bookings whose window has opened.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { processDueBookings } = await import("./lib/booking");
  if (globalThis.__railgoScheduler) clearInterval(globalThis.__railgoScheduler);
  globalThis.__railgoScheduler = setInterval(() => {
    try {
      const n = processDueBookings();
      if (n) console.log(`[railgo] auto-booked ${n} booking(s)`);
    } catch (err) {
      console.error("[railgo] scheduler error", err);
    }
  }, 1000);
  console.log("[railgo] auto-book scheduler running (1s tick)");
}
