"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { trackRun } from "@/app/actions";
import LiveTrain3D from "./LiveTrain3D";
import { AlarmBell, AlarmChip, AlarmPicker, AlarmRinger, askNotificationPermission, useAlarm, useBeeper } from "./StationAlarm";
import TrainIcon from "./TrainIcon";

// Provider refresh. Each poll is one paid/free-quota API call, so not too often;
// between polls the position is estimated (see estimate()).
const POLL_MS = 180e3;
const TICK_MS = 5e3;
const IST = 330 * 60000;

// "HH:MM" (IST) → epoch ms, picking the day closest to `ref`.
function istMs(hhmm, ref) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ""));
  if (!m || !ref) return null;
  const d = new Date(ref + IST);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Number(m[1]), Number(m[2])) - IST;
  if (t - ref > 12 * 3600e3) t -= 864e5;
  else if (ref - t > 12 * 3600e3) t += 864e5;
  return t;
}

/**
 * Estimated position between provider updates: from the last reported km, move toward the
 * next halt at the speed implied by its expected arrival. Never passes the next halt, and
 * returns null when the train isn't running (not started, halted at a station, no data).
 */
function estimate(run, now, fetchedAt) {
  if (!run?.started || run.liveDown || run.fromSchedule || run.kmDone == null) return null;
  if (run.stations.some((s) => s.status === "current" && !s.nonStop)) return null;
  if (/arrived|reached/i.test(run.headline || "")) return null;
  const next = run.stations.find((s) => !s.nonStop && s.status !== "passed" && s.km != null && s.km > run.kmDone);
  if (!next) return null;
  const base = istMs(run.updatedTime, fetchedAt) ?? fetchedAt;
  const eta = istMs(next.eta || next.sta, base);
  let speed = eta && eta - base > 60e3 ? (next.km - run.kmDone) / (eta - base) : null; // km per ms
  if (!speed || !Number.isFinite(speed) || speed <= 0) speed = 50 / 3600e3;
  speed = Math.min(speed, 130 / 3600e3);
  const km = Math.min(next.km - 0.5, run.kmDone + speed * Math.max(0, now - base));
  return { km: Math.max(run.kmDone, km), next };
}

function fmt12(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return hhmm || "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z]/g, "");

function DelayChip({ min }) {
  if (min == null) return null;
  if (min <= 0) return <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">On time</span>;
  return <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-semibold text-warn">{min} min late</span>;
}

export default function LiveTracker({ trainNo, startDay, board, boardName, dest, destName }) {
  const [state, setState] = useState({ loading: true });
  const [showAll, setShowAll] = useState(false);
  // Station alarm, saved per train run (train number + start day + today's date in IST).
  const [alarmKey] = useState(() => `railgo-alarm-${trainNo}-${startDay}-${new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10)}`);
  const [alarm, setAlarm] = useAlarm(alarmKey);
  const beeper = useBeeper();
  const [picker, setPicker] = useState(null); // station whose alarm sheet is open
  const markFired = useCallback(() => alarm && setAlarm({ ...alarm, fired: true }), [alarm, setAlarm]);
  // Non-stop station groups (keyed by index of their first station) the user has opened.
  const [opened, setOpened] = useState(() => new Set());
  const [allOpen, setAllOpen] = useState(false);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);
  const hereRef = useRef(null);
  const routeRef = useRef(null);
  const scrolled = useRef(false);
  // Train-number tracking (no boarding station): bring the train's current station into view once.
  useEffect(() => {
    if (board || scrolled.current || !hereRef.current) return;
    scrolled.current = true;
    hereRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  });

  // Place the moving train on the timeline track: interpolate the live km between the rendered
  // stations (their track markers carry data-km). Positions the element directly, no re-render.
  const trainRef = useRef(null);
  const placeTrain = useCallback(() => {
    const ol = routeRef.current;
    const el = trainRef.current;
    if (!ol || !el) return;
    const km = ol.dataset.trainKm ? Number(ol.dataset.trainKm) : null;
    const base = ol.getBoundingClientRect();
    const pts = [...ol.querySelectorAll("[data-km]")]
      .map((n) => {
        const r = n.getBoundingClientRect();
        return { km: Number(n.dataset.km), x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top };
      })
      .filter((q) => Number.isFinite(q.km));
    if (km == null || pts.length < 2) {
      el.style.display = "none";
      return;
    }
    let p;
    if (km <= pts[0].km) p = pts[0];
    else if (km >= pts.at(-1).km) p = pts.at(-1);
    else {
      const j = pts.findIndex((q) => q.km > km);
      const a = pts[j - 1];
      const b = pts[j];
      const f = b.km === a.km ? 0 : (km - a.km) / (b.km - a.km);
      p = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    el.style.display = "block";
    el.style.left = `${p.x - 16}px`; // badge is 32px
    el.style.top = `${p.y - 16}px`;
  }, []);
  useLayoutEffect(placeTrain);
  useEffect(() => {
    const ol = routeRef.current;
    if (!ol) return;
    const ro = new ResizeObserver(placeTrain);
    ro.observe(ol);
    return () => ro.disconnect();
  }, [state.loading, placeTrain]);

  const load = useCallback(() => {
    return trackRun(trainNo, startDay)
      .then((r) => setState({ ...r, loading: false }))
      .catch(() => setState({ error: "Live status unavailable right now.", loading: false }));
  }, [trainNo, startDay]);

  useEffect(() => {
    let t;
    // Initial fetch, then poll while the tab is visible.
    Promise.resolve().then(load);
    t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (state.loading) {
    return (
      <div className="card flex items-center gap-3 p-6 text-muted">
        <TrainIcon className="size-6 animate-pulse text-accent" /> Finding your train…
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="card space-y-3 p-6">
        <p className="font-semibold">Couldn&apos;t load live status</p>
        <p className="text-sm text-muted">{state.error}</p>
        <button onClick={() => { setState({ loading: true }); load(); }} className="btn-ghost">Try again</button>
      </div>
    );
  }

  const run = state.run;
  const isBoard = (s) => (board && s.code === board) || (boardName && norm(s.name).startsWith(norm(boardName).slice(0, 6)));
  const isDest = (s) => (dest && s.code === dest) || (destName && norm(s.name).startsWith(norm(destName).slice(0, 6)));
  const nonStops = run.stations.filter((s) => s.nonStop).length;
  // Live estimate between provider updates moves the train through the non-stop stations.
  const est = estimate(run, tick, state.fetchedAt);
  const kmNow = est ? est.km : run.kmDone;
  // Read (from the DOM) by the layout effect that positions the timeline train; not started → origin.
  const trainKm = kmNow ?? (run.started ? null : 0);
  // How far the alarm station is (km by position, minutes by its expected arrival).
  const alarmStn = alarm && run.stations.find((s) => s.code === alarm.code && s.name === alarm.name);
  const alarmKm = alarmStn?.km != null && trainKm != null ? alarmStn.km - trainKm : null;
  const alarmEta = alarmStn ? istMs(alarmStn.eta || alarmStn.sta, tick) : null;
  const alarmMin = alarmEta != null ? (alarmEta - tick) / 60000 : null;
  const openPicker = (s) => setPicker({ code: s.code, name: s.name, km: s.km, hasEta: Boolean(s.eta || s.sta) });
  const showTrain = trainKm != null && run.stations.some((s) => s.km != null);
  const progress = est && run.kmTotal ? Math.min(100, (kmNow / run.kmTotal) * 100) : run.progress;
  const stations = est
    ? run.stations.map((s) => (s.nonStop && s.status === "upcoming" && s.km != null && s.km <= est.km ? { ...s, status: "passed" } : s))
    : run.stations;
  // Where the train is: the last passed station, or an explicit "current" one.
  const curIdx = (() => {
    const c = stations.findIndex((s) => s.status === "current");
    if (c !== -1) return c;
    let last = -1;
    stations.forEach((s, i) => s.status === "passed" && (last = i));
    return last;
  })();
  // Exact station code first; name match only as a fallback (avoids TPJ → "Tiruchchirappalli Town").
  const findIdx = (code, byName) => {
    const c = code ? stations.findIndex((s) => s.code === code) : -1;
    return c !== -1 ? c : stations.findIndex(byName);
  };
  const boardIdx = findIdx(board, isBoard);
  const destIdx = findIdx(dest, isDest);
  const boardStn = stations[boardIdx];
  const destStn = stations[destIdx];
  const toBoard = boardIdx > curIdx ? stations.slice(curIdx + 1, boardIdx + 1).filter((s) => !s.nonStop).length : 0;
  const kmToBoard = boardStn?.km != null && kmNow != null ? Math.max(0, Math.round(boardStn.km - kmNow)) : null;
  // By default show only your part of the route (from the train's position or your boarding, to your destination).
  const segFrom = boardIdx !== -1 ? Math.max(0, Math.min(boardIdx, curIdx === -1 ? boardIdx : curIdx)) : 0;
  const segTo = destIdx !== -1 && destIdx >= segFrom ? destIdx : stations.length - 1;
  const trimmed = !showAll && (segFrom > 0 || segTo < stations.length - 1);
  const hidden = stations.length - (segTo - segFrom + 1);
  // Runs of consecutive non-stop stations between two halts: groupOf[i] = index of the run's first station.
  const groupOf = [];
  const groupSize = {};
  stations.forEach((st, i) => {
    if (!st.nonStop) return;
    const start = i > 0 && stations[i - 1].nonStop ? groupOf[i - 1] : i;
    groupOf[i] = start;
    groupSize[start] = (groupSize[start] || 0) + 1;
  });
  const isOpen = (g) => allOpen || opened.has(g) || (curIdx !== -1 && groupOf[curIdx] === g);
  const toggleGroup = (g) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  return (
    <div className="space-y-4 sm:space-y-5">
      <AlarmRinger alarm={alarm} kmToGo={alarmKm} minToGo={alarmMin} onFired={markFired} onStop={() => setAlarm(null)} beeper={beeper} />
      <AlarmPicker
        station={picker}
        current={alarm}
        onClose={() => setPicker(null)}
        onClear={() => {
          setAlarm(null);
          setPicker(null);
        }}
        onSet={(o) => {
          beeper.prime(); // unlock sound on this tap
          askNotificationPermission();
          setAlarm({ code: picker.code, name: picker.name, km: picker.km, mode: o.mode, value: o.value, fired: false });
          setPicker(null);
        }}
      />
      {/* Position hero */}
      <section className="card overflow-hidden">
        <div className="space-y-3 p-4 sm:space-y-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-info-soft text-info sm:size-12 sm:rounded-2xl">
                <TrainIcon className="size-6 sm:size-7" />
                {run.started && !run.liveDown && <span className="absolute -top-1 -right-1 size-3 animate-ping rounded-full bg-info" />}
              </span>
              <div className="min-w-0">
                {!board && run.trainName && <p className="truncate text-xs font-medium text-muted">{run.trainName}</p>}
                <p className="text-[15px] leading-snug font-semibold tracking-tight sm:text-lg">{run.headline || (run.started ? `Near ${run.currentName}` : "Not started yet")}</p>
                {/* The provider's "N kms to X" goes stale between updates; the estimate below replaces it. */}
                {run.subline && !(est && /kms? to/i.test(run.subline)) && <p className="text-xs text-muted sm:text-sm">{run.subline}</p>}
                {est ? (
                  <p className="text-xs font-medium text-info tabular-nums sm:text-sm">
                    ≈ {Math.max(0, Math.round(est.next.km - est.km))} km to {est.next.name}
                    {(est.next.eta || est.next.sta) && ` · ${fmt12(est.next.eta || est.next.sta)}`}
                  </p>
                ) : (
                  run.nextHint && <p className="text-xs font-medium text-info sm:text-sm">{run.nextHint.replace(/\b(\d{1,2}:\d{2})\b/, (t) => fmt12(t))}</p>
                )}
                {alarm ? (
                  <div className="mt-1.5">
                    <AlarmChip alarm={alarm} onEdit={() => alarmStn && openPicker(alarmStn)} onClear={() => setAlarm(null)} />
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-muted">Tap 🔔 on a station below to set an arrival alarm.</p>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <DelayChip min={run.delay} />
              {run.updatedTime && <p className="mt-1 text-[11px] text-muted">Updated {fmt12(run.updatedTime)}</p>}
            </div>
          </div>

          {progress != null && (
            <div>
              <div className="relative h-2 rounded-full bg-surface-2">
                <div className="h-2 rounded-full bg-info transition-all duration-1000" style={{ width: `${progress}%` }} />
                <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface p-0.5 shadow" style={{ left: `${progress}%`, transition: "left 1s linear" }}>
                  <TrainIcon className="size-4 text-info" />
                </span>
              </div>
              <div className="mt-2 flex justify-between gap-2 text-[10px] text-muted sm:text-xs">
                <span className="truncate">{run.fromName}</span>
                <span className="shrink-0 tabular-nums">{kmNow != null ? `${est ? "≈ " : ""}${Math.round(kmNow)} / ${run.kmTotal} km` : `${Math.round(progress)}%`}</span>
                <span className="truncate text-right">{run.toName}</span>
              </div>
            </div>
          )}
        </div>

        {(boardStn || destStn) && (
          <div className="grid grid-cols-2 border-t border-line text-sm">
            {boardStn && (
              <div className="min-w-0 p-3 sm:p-4">
                <p className="truncate text-[11px] text-muted sm:text-xs">Boarding · {boardStn.name}</p>
                <p className="mt-0.5 text-[13px] leading-snug font-semibold sm:text-sm">
                  {!run.started && boardIdx === curIdx
                    ? "Train starts from your station"
                    : boardIdx < curIdx || (boardIdx === curIdx && run.started)
                      ? "Train has left your boarding station"
                      : `${toBoard} stop${toBoard === 1 ? "" : "s"} away${kmToBoard != null ? ` · ${kmToBoard} km` : ""}`}
                </p>
                <p className="mt-0.5 text-[11px] text-muted sm:text-xs">
                  Expected {fmt12(boardStn.etd || boardStn.eta || boardStn.std || boardStn.sta)}
                  {boardStn.platform ? ` · Platform ${boardStn.platform}` : ""}
                </p>
              </div>
            )}
            {destStn && (
              <div className={`min-w-0 border-line p-3 sm:p-4 ${boardStn ? "border-l" : ""}`}>
                <p className="truncate text-[11px] text-muted sm:text-xs">Destination · {destStn.name}</p>
                <p className="mt-0.5 text-[13px] leading-snug font-semibold sm:text-sm">Arrives {fmt12(destStn.eta || destStn.sta)}</p>
                <p className="mt-0.5 text-[11px] text-muted sm:text-xs">Scheduled {fmt12(destStn.sta)}{destStn.platform ? ` · Platform ${destStn.platform}` : ""}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3D: the train on its track between station boards */}
      {stations.some((s) => s.km != null) && (
        <LiveTrain3D
          stations={run.stations}
          km={kmNow ?? 0}
          moving={Boolean(est)}
          nextName={(() => {
            const n = est?.next || stations.find((s, i) => i > curIdx && !s.nonStop);
            if (!n) return run.started ? null : `Starts from ${stations[0]?.name}`;
            const away = n.km != null && kmNow != null ? Math.max(0, Math.round(n.km - kmNow)) : null;
            return `Next: ${n.name}${away != null ? ` · ≈ ${away} km` : ""}`;
          })()}
        />
      )}

      {/* Timeline */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <h2 className="font-semibold tracking-tight">Route</h2>
            <p className="text-xs text-muted">
              {run.stations.length - nonStops} stops{nonStops ? ` · ${nonStops} non-stop` : ""}{run.kmTotal ? ` · ${run.kmTotal} km` : ""}
              {run.fromSchedule ? " · scheduled timings" : " · live"}
            </p>
          </div>
          {nonStops > 0 && (
            <button
              onClick={() => {
                setAllOpen((v) => !v);
                setOpened(new Set());
              }}
              className="rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted hover:text-ink"
            >
              {allOpen ? "Collapse all" : "Show all stations"}
            </button>
          )}
          {run.fromSchedule && (
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-muted">
              {run.liveDown ? "Live feed unavailable" : "Live positions start when the train departs"}
            </span>
          )}
        </div>
        {stations.length === 0 && <p className="px-5 py-6 text-sm text-muted">Route details aren&apos;t available for this train yet.</p>}
        <ol ref={routeRef} data-train-km={trainKm ?? ""} className="relative py-2">
          {showTrain && (
            <li ref={trainRef} aria-hidden className="pointer-events-none absolute z-20 hidden" style={{ transition: "top 1s linear, left .3s" }}>
              <span className="relative grid size-8 place-items-center rounded-full bg-info text-white ring-4 ring-surface">
                {run.started && !run.liveDown && <span className="absolute inset-0 animate-ping rounded-full bg-info opacity-30" />}
                <TrainIcon className="relative size-5" />
              </span>
            </li>
          )}
          {trimmed && segFrom > 0 && (
            <li className="px-4 pb-1 sm:px-5">
              <button onClick={() => setShowAll(true)} className="w-full rounded-lg bg-surface-2 py-1.5 text-xs font-medium text-muted hover:text-ink">
                Show {segFrom} earlier station{segFrom === 1 ? "" : "s"}
              </button>
            </li>
          )}
          {stations.map((s, i) => {
            if (trimmed && (i < segFrom || i > segTo)) return null;
            const passed = i < curIdx;
            const here = i === curIdx;
            const isB = i === boardIdx;
            const isD = i === destIdx;
            const mine = isB || isD;
            const first = i === 0;
            const last = i === stations.length - 1;
            const arr = s.eta || s.sta;
            const dep = s.etd || s.std;
            const halt = (() => {
              const a = String(s.sta || "").match(/(\d+):(\d+)/);
              const d = String(s.std || "").match(/(\d+):(\d+)/);
              if (!a || !d) return null;
              const m = (Number(d[1]) * 60 + Number(d[2]) - (Number(a[1]) * 60 + Number(a[2])) + 1440) % 1440;
              return m > 0 && m < 120 ? m : null;
            })();
            const prevDay = i > 0 ? stations[i - 1].day ?? 0 : s.day ?? 0;
            const newDay = i > 0 && (s.day ?? 0) > prevDay;
            const lineTop = i > 0 && i <= curIdx ? "bg-info" : "bg-line";
            const lineBottom = i < curIdx ? "bg-info" : "bg-line";
            // Collapsed run of non-stop stations: one tappable row.
            if (s.nonStop && !isOpen(groupOf[i])) {
              if (groupOf[i] !== i) return null;
              const n = groupSize[i];
              return (
                <li key={`ns-${i}`}>
                  <div className="grid grid-cols-[62px_24px_1fr] gap-2 px-3 sm:grid-cols-[88px_32px_1fr] sm:gap-3 sm:px-5">
                    <span />
                    <div className="relative flex justify-center">
                      <span className={`absolute inset-y-0 w-[3px] ${i <= curIdx ? "bg-info" : "bg-line"}`} />
                    </div>
                    <button
                      onClick={() => toggleGroup(i)}
                      aria-expanded="false"
                      className="my-0.5 flex w-fit items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted hover:bg-surface-2 hover:text-ink sm:text-xs"
                    >
                      <span aria-hidden>▸</span> {n} station{n === 1 ? "" : "s"} · no stop
                    </button>
                  </div>
                </li>
              );
            }
            // Non-stop station: slim row, no timings.
            if (s.nonStop && !here && !mine) {
              return (
                <li key={`${s.code || s.name}-${i}`}>
                  <div className="grid grid-cols-[62px_24px_1fr] gap-2 px-3 sm:grid-cols-[88px_32px_1fr] sm:gap-3 sm:px-5">
                    <span />
                    <div className="relative flex justify-center">
                      <span className={`absolute top-0 h-1/2 w-[3px] ${lineTop}`} />
                      <span className={`absolute bottom-0 h-1/2 w-[3px] ${lineBottom}`} />
                      <span data-km={s.km ?? undefined} className={`relative z-10 size-1.5 self-center rounded-full ${passed ? "bg-info" : "bg-line"}`} />
                    </div>
                    <button
                      onClick={() => (allOpen ? null : toggleGroup(groupOf[i]))}
                      title={allOpen ? undefined : "Collapse"}
                      className={`flex min-w-0 items-center gap-1.5 py-1 text-left text-[11px] sm:text-xs ${passed ? "text-muted/70" : "text-muted"}`}
                    >
                      <span className="truncate">{s.name}</span>
                      {s.code && <span className="shrink-0 font-mono text-[9px] opacity-70">{s.code}</span>}
                      {s.km != null && <span className="shrink-0 opacity-70">· {s.km} km</span>}
                    </button>
                  </div>
                </li>
              );
            }
            return (
              <li key={`${s.code || s.name}-${i}`} ref={here ? hereRef : undefined}>
                {newDay && (
                  <div className="grid grid-cols-[62px_24px_1fr] items-center gap-2 px-3 py-1 sm:grid-cols-[88px_32px_1fr] sm:gap-3 sm:px-5">
                    <span />
                    <span className="mx-auto h-4 w-0.5 bg-line" />
                    <span className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
                      Day {(s.day ?? 0) + (stations[0].day === 1 ? 0 : 1)}
                      <span className="h-px flex-1 bg-line" />
                    </span>
                  </div>
                )}
                <div className={`grid grid-cols-[62px_24px_1fr] gap-2 px-3 transition sm:grid-cols-[88px_32px_1fr] sm:gap-3 sm:px-5 ${here ? "bg-info-soft/60" : mine ? "bg-accent-soft/50" : "hover:bg-surface-2/60"}`}>
                  {/* times */}
                  <div className="py-2 text-right whitespace-nowrap tabular-nums sm:py-3">
                    {first ? (
                      <p className={`text-xs font-semibold sm:text-sm ${passed ? "text-muted" : ""}`}>{fmt12(dep) || "—"}</p>
                    ) : s.nonStop ? null : (
                      <p className={`text-xs font-semibold sm:text-sm ${passed ? "text-muted" : ""}`}>{fmt12(arr) || "—"}</p>
                    )}
                    {!first && s.eta && s.sta && s.eta !== s.sta && <p className="text-[10px] text-muted line-through sm:text-[11px]">{fmt12(s.sta)}</p>}
                    {!first && !last && dep && dep !== arr && <p className="text-[10px] text-muted sm:text-[11px]">dep {fmt12(dep)}</p>}
                    {first && <p className="text-[11px] text-muted">Starts</p>}
                    {last && <p className="text-[11px] text-muted">Ends</p>}
                  </div>

                  {/* rail */}
                  <div className="relative flex justify-center">
                    {!first && <span className={`absolute top-0 h-1/2 w-[3px] rounded-b ${lineTop}`} />}
                    {!last && <span className={`absolute bottom-0 h-1/2 w-[3px] rounded-t ${lineBottom}`} />}
                    <span className="relative z-10 self-center" data-km={s.km ?? undefined}>
                      {here && !showTrain ? (
                        <span className="relative grid size-8 place-items-center rounded-full bg-info text-white ring-4 ring-surface">
                          {run.started && !run.liveDown && <span className="absolute inset-0 animate-ping rounded-full bg-info opacity-30" />}
                          <TrainIcon className="relative size-5" />
                        </span>
                      ) : mine ? (
                        <span className={`grid size-5 place-items-center rounded-full ring-4 ring-surface ${passed ? "bg-info" : "bg-accent"}`}>
                          <span className="size-2 rounded-full bg-surface" />
                        </span>
                      ) : (
                        <span className={`block rounded-full ring-4 ring-surface ${passed ? "size-3 bg-info" : first || last ? "size-3 border-2 border-ink bg-surface" : "size-2.5 border-2 border-line bg-surface"}`} />
                      )}
                    </span>
                  </div>

                  {/* station */}
                  <div className="flex min-w-0 flex-col items-start gap-1.5 py-2 sm:flex-row sm:py-3 sm:gap-2 sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <p className={`truncate text-sm sm:text-base ${mine || here || first || last ? "font-semibold" : "font-medium"} ${passed && !here ? "text-muted" : ""}`}>
                        {s.name}
                        {s.code && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 align-middle font-mono text-[10px] font-medium text-muted">{s.code}</span>}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted sm:mt-1 sm:gap-x-2.5 sm:text-[11px]">
                        {s.platform && <span className="rounded border border-line px-1.5 font-medium">PF {s.platform}</span>}
                        {s.km != null && <span>{s.km} km</span>}
                        {halt && <span>{halt}m halt</span>}
                        {s.delay != null && s.delay > 0 && <span className="rounded bg-warn-soft px-1.5 font-semibold text-warn">+{s.delay} min</span>}
                        {here && (
                          <span className="font-semibold text-info">
                            {s.nonStop ? "Running near here · no stop" : run.started ? "Train is here" : `Waiting to depart${s.std ? ` · ${fmt12(s.std)}` : ""}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {mine && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-[11px] ${passed ? "bg-surface-2 text-muted" : "bg-accent text-accent-ink"}`}>
                          {isB ? "Board here" : "Get down here"}
                        </span>
                      )}
                      {!passed && !here && (
                        <AlarmBell name={s.name} active={Boolean(alarm && alarm.code === s.code && alarm.name === s.name)} onClick={() => openPicker(s)} />
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
          {trimmed && segTo < stations.length - 1 && (
            <li className="px-4 pt-1 sm:px-5">
              <button onClick={() => setShowAll(true)} className="w-full rounded-lg bg-surface-2 py-1.5 text-xs font-medium text-muted hover:text-ink">
                Show {stations.length - 1 - segTo} later station{stations.length - 1 - segTo === 1 ? "" : "s"}
              </button>
            </li>
          )}
          {showAll && hidden > 0 && (
            <li className="px-4 pt-1 sm:px-5">
              <button onClick={() => setShowAll(false)} className="w-full rounded-lg bg-surface-2 py-1.5 text-xs font-medium text-muted hover:text-ink">
                Show only my journey
              </button>
            </li>
          )}
        </ol>
        <p className="border-t border-line px-4 py-3 text-[10px] text-muted sm:px-5 sm:text-[11px]">
          {run.fromSchedule ? "Timetable" : `Live data from ${state.provider}`}. Crowd-sourced running status may vary; confirm at the station. Live position refreshes every 3 minutes; ≈ values are estimated in between.
        </p>
      </section>
    </div>
  );
}

