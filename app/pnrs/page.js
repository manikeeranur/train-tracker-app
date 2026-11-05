import { redirect } from "next/navigation";

// Real IRCTC tickets now live on My bookings.
export default async function PnrsPage({ searchParams }) {
  const { add } = await searchParams;
  redirect(/^\d{10}$/.test(add || "") ? `/bookings?add=${add}` : "/bookings");
}
