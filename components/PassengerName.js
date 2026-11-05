"use client";

import { useState } from "react";
import { namePassenger } from "@/app/actions";

/** Click "Passenger 1" to give it a name; suggestions come from the saved passengers list. */
export default function PassengerName({ id, n, name, listId }) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`max-w-full truncate text-left hover:underline ${name ? "font-medium text-ink" : "text-muted"}`}
        title="Set passenger name"
      >
        {name || `Passenger ${n}`} <span className="text-xs text-muted">✎</span>
      </button>
    );
  }
  return (
    <form action={async (fd) => { await namePassenger(fd); setEditing(false); }} className="flex min-w-0 flex-1 items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="n" value={n} />
      <input
        name="name"
        defaultValue={name || ""}
        list={listId}
        autoFocus
        maxLength={40}
        placeholder={`Passenger ${n} name`}
        className="field min-w-0 py-1 text-sm"
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
      />
      <button className="btn-primary shrink-0 px-2.5 py-1 text-xs">Save name</button>
    </form>
  );
}
