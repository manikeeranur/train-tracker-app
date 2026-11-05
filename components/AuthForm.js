"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/app/actions";

export default function AuthForm({ mode, next }) {
  const isSignup = mode === "signup";
  const [state, action, pending] = useActionState(isSignup ? signup : login, null);
  const q = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-muted">{isSignup ? "Save passengers and schedule auto-bookings." : "Log in to book and track your tickets."}</p>
      </div>
      <form action={action} className="card space-y-4 p-5">
        <input type="hidden" name="next" value={next || "/"} />
        {isSignup && (
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" name="name" className="field" autoComplete="name" required />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="field" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" minLength={isSignup ? 8 : undefined} className="field" autoComplete={isSignup ? "new-password" : "current-password"} required />
        </div>
        {state?.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
        <button className="btn-primary w-full py-3" disabled={pending}>{pending ? "Please wait…" : isSignup ? "Sign up" : "Log in"}</button>
      </form>
      <p className="text-center text-sm text-muted">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link className="font-semibold text-accent" href={`${isSignup ? "/login" : "/signup"}${q}`}>{isSignup ? "Log in" : "Create an account"}</Link>
      </p>
    </div>
  );
}
