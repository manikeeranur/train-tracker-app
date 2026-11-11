import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { col, one } from "./db";

const COOKIE = "railgo_session";
const SESSION_DAYS = 30;

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + SESSION_DAYS * 864e5;
  // `expires` (a Date) drives the TTL index that deletes old sessions.
  await (await col("sessions")).insertOne({ token, user_id: userId, expires_at: expires, expires: new Date(expires) });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expires),
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await (await col("sessions")).deleteOne({ token });
  store.delete(COOKIE);
}

export const getUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await one("sessions", { token, expires_at: { $gt: Date.now() } });
  if (!session) return null;
  return one("users", { id: session.user_id }, { projection: { id: 1, name: 1, email: 1 } });
});

export async function requireUser(next = "/") {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
