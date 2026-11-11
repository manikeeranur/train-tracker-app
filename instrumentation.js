// Starts the auto-booking scheduler once per server process.
// Every second it books all SCHEDULED bookings whose window has opened.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { processDueBookings } = await import("./lib/booking");
  if (globalThis.__railgoScheduler) clearInterval(globalThis.__railgoScheduler);
  let busy = false; // ticks never overlap now that a tick awaits the database
  globalThis.__railgoScheduler = setInterval(async () => {
    if (busy || !process.env.MONGO_URI) return;
    busy = true;
    try {
      const n = await processDueBookings();
      if (n) console.log(`[railgo] auto-booked ${n} booking(s)`);
    } catch (err) {
      console.error("[railgo] scheduler error", err);
    } finally {
      busy = false;
    }
  }, 1000);
  console.log("[railgo] auto-book scheduler running (1s tick)");
}
