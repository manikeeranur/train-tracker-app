"use client";

import { useEffect, useId, useRef, useState } from "react";
import { suggestStations } from "@/app/actions";

/**
 * Type a city or station name ("trichy", "egmore") and pick from suggestions.
 * Submits the station code in a hidden input named `name`.
 */
export default function StationInput({ name, label, defaultCode = "", defaultName = "", placeholder, required }) {
  const id = useId();
  const [code, setCode] = useState(defaultCode);
  const [text, setText] = useState(defaultName ? `${defaultName} (${defaultCode})` : defaultCode);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = text.replace(/\s*\([A-Z]{1,5}\)\s*$/, "").trim();
    if (!open || term.length < 2) return;
    const mine = ++seq.current;
    const t = setTimeout(() => {
      setLoading(true);
      suggestStations(term)
        .then((r) => {
          if (mine === seq.current) {
            setItems(r);
            setActive(0);
          }
        })
        .finally(() => mine === seq.current && setLoading(false));
    }, 220);
    return () => clearTimeout(t);
  }, [text, open]);

  function choose(s) {
    setCode(s.code);
    setText(`${s.name} (${s.code})`);
    setOpen(false);
  }

  function onKey(e) {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <label className="label" htmlFor={id}>{label}</label>
      <input type="hidden" name={name} value={code} />
      <input
        id={id}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          // Typing a bare code ("MS") still works without picking a suggestion.
          setCode(/^[A-Za-z]{2,5}$/.test(e.target.value.trim()) ? e.target.value.trim().toUpperCase() : "");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={`${id}-list`}
        required={required}
        className="field"
      />
      {open && text.trim().length >= 2 && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
          {loading && !items.length && <li className="px-3 py-2 text-sm text-muted">Searching…</li>}
          {!loading && !items.length && <li className="px-3 py-2 text-sm text-muted">No stations found</li>}
          {items.map((s, i) => (
            <li
              key={s.code}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${i === active ? "bg-accent-soft" : ""}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{s.name}</span>
                {s.city && s.city.toLowerCase() !== s.name.toLowerCase() && <span className="block text-xs text-muted">{s.city}</span>}
              </span>
              <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">{s.code}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
