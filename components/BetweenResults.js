"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { normaliseBetween } from "@/lib/between";
import TrainIcon from "./TrainIcon";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SLOTS = [
  { id: 0, label: "00:00 – 06:00", hint: "Early morning", from: 0, to: 360 },
  { id: 1, label: "06:00 – 12:00", hint: "Morning", from: 360, to: 720 },
  { id: 2, label: "12:00 – 18:00", hint: "Afternoon", from: 720, to: 1080 },
  { id: 3, label: "18:00 – 24:00", hint: "Night", from: 1080, to: 1440 },
];
const SORTS = [
  ["dep", "Earliest departure"],
  ["depLate", "Latest departure"],
  ["arr", "Earliest arrival"],
  ["fast", "Fastest"],
];

const TYPE_TONE = [
  [/VANDE|SHATABDI|RAJDHANI|DURONTO|TEJAS|HUMSAFAR/i, "bg-accent-soft text-accent"],
  [/SUPERFAST|SF/i, "bg-info-soft text-info"],
  [/SPECIAL/i, "bg-warn-soft text-warn"],
];
const toneFor = (t) => TYPE_TONE.find(([re]) => re.test(t || ""))?.[1] ?? "bg-surface-2 text-muted";
const prettyType = (t) => String(t || "").toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

const mins = (t) => {
  const m = String(t || "").match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 9999;
};
const travelMins = (s) => mins(s);
function dur(s) {
  const m = String(s || "").match(/(\d{1,2}):(\d{2})/);
  return m ? `${Number(m[1])}h ${m[2]}m` : s || "";
}
function fmt12(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return hhmm || "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}
// Monday = 0 … Sunday = 6, from a YYYY-MM-DD string (no timezone drift).
const weekday = (iso) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
const isoPlus = (base, n) => new Date(Date.parse(`${base}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const fmtDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// Availability tone: AVL green, RAC blue, WL amber, regret/closed grey.
function availTone(st) {
  const v = String(st || "");
  if (/AVL|AVAILABLE/i.test(v)) return "text-accent";
  if (/RAC/i.test(v)) return "text-info";
  if (/WL/i.test(v)) return "text-warn";
  return "text-muted";
}
const isAvailable = (c) => /AVL|AVAILABLE|RAC/i.test(String(c.displayStatus || c.availability || ""));
const CLASS_ORDER = ["1A", "EC", "2A", "EA", "3A", "3E", "CC", "SL", "2S"];
const inr = (n) => (n == null || n === "" || Number.isNaN(Number(n)) ? "" : `₹${Number(n).toLocaleString("en-IN")}`);

function Toggle({ on, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition ${on ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function Group({ title, children }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</p>
      {children}
    </div>
  );
}

export default function BetweenResults({ data, query, today, initialDate, avail }) {
  const router = useRouter();
  const [loadingDate, startDate] = useTransition();
  const all = useMemo(() => normaliseBetween(data), [data]);
  const seats = avail?.trains || null;
  const classesOf = (t) => (seats?.[t.no]?.classAvailability || []).slice().sort((a, b) => CLASS_ORDER.indexOf(a.class) - CLASS_ORDER.indexOf(b.class));
  const allClasses = useMemo(
    () => (seats ? [...new Set(Object.values(seats).flatMap((t) => (t.classAvailability || []).map((c) => c.class)))].sort((a, b) => CLASS_ORDER.indexOf(a) - CLASS_ORDER.indexOf(b)) : []),
    [seats]
  );
  const [onlyAvail, setOnlyAvail] = useState(false);
  const [classSel, setClassSel] = useState([]);
  const types = useMemo(() => [...new Set(all.map((t) => t.type).filter(Boolean))].sort(), [all]);

  const [date, setDate] = useState(initialDate || "");
  const [day, setDay] = useState(initialDate ? weekday(initialDate) : null);
  const [dep, setDep] = useState([]);
  const [arr, setArr] = useState([]);
  const [typeSel, setTypeSel] = useState([]);
  const [sort, setSort] = useState("dep");
  const [open, setOpen] = useState(false);

  const toggle = (list, set, v) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const pickDate = (iso) => {
    setDate(iso);
    setDay(iso ? weekday(iso) : null);
    // New date → reload availability for that date (train list itself stays cached).
    const u = new URL(window.location.href);
    if (iso) u.searchParams.set("date", iso);
    else u.searchParams.delete("date");
    startDate(() => router.push(`${u.pathname}${u.search}`, { scroll: false }));
  };
  const pickDay = (i) => {
    setDate("");
    setDay(day === i ? null : i);
  };
  const reset = () => {
    pickDate("");
    setDep([]);
    setArr([]);
    setTypeSel([]);
    setSort("dep");
    setOnlyAvail(false);
    setClassSel([]);
  };
  const active = (day != null) + dep.length + arr.length + typeSel.length + onlyAvail + classSel.length;

  const shown = useMemo(() => {
    const inSlots = (t, sel) => !sel.length || sel.some((id) => mins(t) >= SLOTS[id].from && mins(t) < SLOTS[id].to);
    const list = all.filter(
      (t) =>
        (day == null || t.days[day] === "1") &&
        inSlots(t.dep, dep) &&
        inSlots(t.arr, arr) &&
        (!typeSel.length || typeSel.includes(t.type)) &&
        (!seats || !classSel.length || classesOf(t).some((c) => classSel.includes(c.class) && (!onlyAvail || isAvailable(c)))) &&
        (!seats || !onlyAvail || classesOf(t).some((c) => (!classSel.length || classSel.includes(c.class)) && isAvailable(c)))
    );
    const by = {
      dep: (a, b) => mins(a.dep) - mins(b.dep),
      depLate: (a, b) => mins(b.dep) - mins(a.dep),
      arr: (a, b) => mins(a.arr) - mins(b.arr),
      fast: (a, b) => travelMins(a.travel) - travelMins(b.travel),
    }[sort];
    return [...list].sort(by);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, day, dep, arr, typeSel, sort, seats, onlyAvail, classSel]);

  const filters = (
    <div className="space-y-5">
      <Group title="Journey date">
        <div className="flex flex-wrap gap-1.5">
          <Toggle on={date === today} onClick={() => pickDate(date === today ? "" : today)}>Today</Toggle>
          <Toggle on={date === isoPlus(today, 1)} onClick={() => pickDate(date === isoPlus(today, 1) ? "" : isoPlus(today, 1))}>Tomorrow</Toggle>
        </div>
        <input type="date" value={date} min={today} onChange={(e) => pickDate(e.target.value)} className="field py-1.5 text-sm" aria-label="Journey date" />
      </Group>

      {seats && (
        <Group title="Seats">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-surface-2">
            <input type="checkbox" checked={onlyAvail} onChange={() => setOnlyAvail(!onlyAvail)} className="size-4 accent-[var(--accent)]" />
            Available / RAC only
          </label>
          <div className="flex flex-wrap gap-1.5">
            {allClasses.map((c) => (
              <Toggle key={c} on={classSel.includes(c)} onClick={() => toggle(classSel, setClassSel, c)}>{c}</Toggle>
            ))}
          </div>
        </Group>
      )}

      <Group title="Running day">
        <div className="grid grid-cols-7 gap-1">
          {DAY_NAMES.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => pickDay(i)}
              aria-pressed={day === i}
              title={d}
              className={`rounded-lg py-1.5 text-[11px] font-semibold transition ${day === i ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted hover:text-ink"}`}
            >
              {d.slice(0, 2)}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Sort by">
        <div className="grid grid-cols-2 gap-1.5">
          {SORTS.map(([k, l]) => (
            <Toggle key={k} on={sort === k} onClick={() => setSort(k)}>{l}</Toggle>
          ))}
        </div>
      </Group>

      <Group title={`Departure from ${query.from}`}>
        <div className="grid grid-cols-2 gap-1.5">
          {SLOTS.map((s) => (
            <Toggle key={s.id} on={dep.includes(s.id)} onClick={() => toggle(dep, setDep, s.id)}>
              <span className="block">{s.label}</span>
              <span className="block text-[10px] opacity-75">{s.hint}</span>
            </Toggle>
          ))}
        </div>
      </Group>

      <Group title={`Arrival at ${query.to}`}>
        <div className="grid grid-cols-2 gap-1.5">
          {SLOTS.map((s) => (
            <Toggle key={s.id} on={arr.includes(s.id)} onClick={() => toggle(arr, setArr, s.id)}>
              <span className="block">{s.label}</span>
              <span className="block text-[10px] opacity-75">{s.hint}</span>
            </Toggle>
          ))}
        </div>
      </Group>

      {types.length > 1 && (
        <Group title="Train type">
          <div className="space-y-1">
            {types.map((t) => (
              <label key={t} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-1 py-1 text-sm hover:bg-surface-2">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={typeSel.includes(t)} onChange={() => toggle(typeSel, setTypeSel, t)} className="size-4 accent-[var(--accent)]" />
                  {prettyType(t)}
                </span>
                <span className="text-xs text-muted">{all.filter((x) => x.type === t).length}</span>
              </label>
            ))}
          </div>
        </Group>
      )}

      {active > 0 && (
        <button type="button" onClick={reset} className="w-full rounded-lg py-2 text-sm font-medium text-danger hover:bg-danger-soft">
          Reset filters
        </button>
      )}
    </div>
  );

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
      {/* Filters: sidebar on desktop, drawer on mobile */}
      <aside className="lg:sticky lg:top-20">
        <button type="button" onClick={() => setOpen(!open)} className="btn-ghost w-full lg:hidden">
          Filters{active > 0 ? ` (${active})` : ""} {open ? "▲" : "▼"}
        </button>
        <div className={`${open ? "mt-3 block" : "hidden"} rounded-2xl bg-surface p-4 lg:mt-0 lg:block`}>{filters}</div>
      </aside>

      <div className="min-w-0 space-y-3">
        <p className="text-sm text-muted">
          <span className="font-semibold text-ink">{shown.length}</span> of {all.length} trains · {query.from} → {query.to}
          {date ? <> · {fmtDate(date)}</> : day != null ? <> · runs on {DAY_NAMES[day]}</> : null}
          {loadingDate && <span className="ml-2 text-info">Loading seats…</span>}
        </p>
        {!date && <p className="rounded-xl bg-info-soft px-3 py-2 text-xs text-info">Pick a journey date to see seat availability and fares.</p>}
        {date && avail?.error && <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">Seat availability unavailable: {avail.error}</p>}

        {shown.length === 0 && (
          <div className="rounded-2xl bg-surface p-8 text-center text-sm text-muted">
            No trains match these filters.{" "}
            <button type="button" onClick={reset} className="font-semibold text-accent">Reset</button>
          </div>
        )}

        <ul className="space-y-3">
          {shown.map((t) => (
            <li key={t.no} className="min-w-0 rounded-2xl bg-surface p-4 sm:p-5">
              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(180px,1fr)_minmax(300px,1.5fr)_auto] xl:items-center">
                {/* Train */}
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                    <TrainIcon className="size-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold tracking-tight">{t.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-muted">#{t.no}</span>
                      {t.type && <span className={`rounded-md px-1.5 py-0.5 font-semibold ${toneFor(t.type)}`}>{prettyType(t.type)}</span>}
                    </div>
                    {(t.src || t.dst) && <p className="mt-1 truncate text-[11px] text-muted">{t.src} → {t.dst}</p>}
                  </div>
                </div>

                {/* Times */}
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(80px,1fr)_minmax(0,1fr)] items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-xl font-bold tracking-tight whitespace-nowrap tabular-nums">{fmt12(t.dep)}</p>
                    <p className="truncate text-xs">
                      <span className="font-semibold">{t.from}</span> <span className="hidden text-muted sm:inline">{t.fromName}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-1 text-[11px] text-muted">
                    <span className="font-medium text-ink">{dur(t.travel)}</span>
                    <div className="flex w-full items-center">
                      <span className="size-1.5 rounded-full border border-accent" />
                      <span className="flex-1 border-t-2 border-dotted border-line" />
                      <span className="size-1.5 rounded-full bg-accent" />
                    </div>
                    <span>
                      {t.km ? `${t.km} km` : ""}
                      {t.halts != null ? ` · ${t.halts} stop${t.halts === 1 ? "" : "s"}` : ""}
                    </span>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-xl font-bold tracking-tight whitespace-nowrap tabular-nums">{fmt12(t.arr)}</p>
                    <p className="truncate text-xs">
                      <span className="hidden text-muted sm:inline">{t.toName}</span> <span className="font-semibold">{t.to}</span>
                    </p>
                  </div>
                </div>

                {/* Days + actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 xl:flex-col xl:items-end">
                  <div className="flex gap-0.5" aria-label="Running days">
                    {DAYS.map((d, i) => {
                      const runs = t.days[i] === "1";
                      return (
                        <span
                          key={i}
                          title={`${DAY_NAMES[i]}${runs ? "" : " (doesn't run)"}`}
                          className={`grid size-6 place-items-center rounded-md text-[10px] font-semibold ${runs ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted/50 line-through"} ${day === i ? "ring-2 ring-accent" : ""}`}
                        >
                          {d}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex gap-1.5">
                    <Link href={`/live?tab=schedule&go=1&train=${t.no}`} className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium hover:text-accent">Schedule</Link>
                    <Link href={`/live?tab=running&go=1&train=${t.no}`} className="rounded-lg bg-info-soft px-2.5 py-1 text-xs font-semibold text-info hover:brightness-95">Live status</Link>
                  </div>
                </div>
              </div>

              {classesOf(t).length > 0 && (
                <div className="mt-4 flex gap-2 overflow-x-auto border-t border-line pt-3 pb-1">
                  {classesOf(t).map((c) => (
                    <div
                      key={c.class}
                      className={`min-w-28 shrink-0 rounded-xl px-3 py-2 ${classSel.length && !classSel.includes(c.class) ? "opacity-40" : ""} ${isAvailable(c) ? "bg-accent-soft/60" : "bg-surface-2"}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-bold">{c.class}</span>
                        <span className="text-xs font-medium text-muted">{inr(c.fare)}</span>
                      </div>
                      <p className={`mt-0.5 text-sm font-semibold ${availTone(c.displayStatus || c.availability)}`}>{c.displayStatus || c.availability}</p>
                      {c.prediction && c.prediction !== "Available" && <p className="text-[10px] text-muted">{c.prediction}</p>}
                    </div>
                  ))}
                </div>
              )}
              {seats && !classesOf(t).length && (
                <p className="mt-3 border-t border-line pt-3 text-xs text-muted">No availability data for this train on {fmtDate(date)}.</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
