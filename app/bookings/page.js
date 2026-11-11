import RealTickets from "@/components/RealTickets";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "My bookings" };

export default async function BookingsPage({ searchParams }) {
  const { add = "", tab = "" } = await searchParams;
  const user = await requireUser("/bookings");
  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">My bookings</h1>
      <RealTickets userId={user.id} add={add} tab={tab === "completed" ? "completed" : "upcoming"} />
    </div>
  );
}
