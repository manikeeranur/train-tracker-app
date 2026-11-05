"use client";

import { useCallback, useEffect, useState } from "react";
import { trackRun } from "@/app/actions";
import TrainIcon from "./TrainIcon";

const POLL_MS = 60e3;

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
  const stations = run.stations;
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
  const toBoard = boardIdx > curIdx ? boardIdx - Math.max(curIdx, 0) : 0;
  const kmToBoard = boardStn?.km != null && run.kmDone != null ? Math.max(0, boardStn.km - run.kmDone) : null;

  return (
    <div className="space-y-5">
      {/* Position hero */}
      <section className="card overflow-hidden">
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="relative grid size-12 place-items-center rounded-2xl bg-info-soft text-info">
                <TrainIcon className="size-7" />
                {run.started && !run.liveDown && <span className="absolute -top-1 -right-1 size-3 animate-ping rounded-full bg-info" />}
              </span>
              <div>
                <p className="text-lg font-semibold tracking-tight">{run.headline || (run.started ? `Near ${run.currentName}` : "Not started yet")}</p>
                {run.subline && <p className="text-sm text-muted">{run.subline}</p>}
                {run.nextHint && <p className="text-sm font-medium text-info">{run.nextHint.replace(/\b(\d{1,2}:\d{2})\b/, (t) => fmt12(t))}</p>}
              </div>
            </div>
            <div className="text-right">
              <DelayChip min={run.delay} />
              {run.updatedTime && <p className="mt-1 text-[11px] text-muted">Updated {fmt12(run.updatedTime)}</p>}
            </div>
          </div>

          {run.progress != null && (
            <div>
              <div className="relative h-2 rounded-full bg-surface-2">
                <div className="h-2 rounded-full bg-info transition-all" style={{ width: `${run.progress}%` }} />
                <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface p-0.5 shadow" style={{ left: `${run.progress}%` }}>
                  <TrainIcon className="size-4 text-info" />
                </span>
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted">
                <span>{run.fromName}</span>
                <span>{run.kmDone != null ? `${run.kmDone} / ${run.kmTotal} km` : `${Math.round(run.progress)}%`}</span>
                <span>{run.toName}</span>
              </div>
            </div>
          )}
        </div>

        {(boardStn || destStn) && (
          <div className="grid border-t border-line text-sm sm:grid-cols-2">
            {boardStn && (
              <div className="p-4">
                <p className="text-xs text-muted">Your boarding · {boardStn.name}</p>
                <p className="mt-0.5 font-semibold">
                  {!run.started && boardIdx === curIdx
                    ? "Train starts from your station"
                    : boardIdx < curIdx || (boardIdx === curIdx && run.started)
                      ? "Train has left your boarding station"
                      : `${toBoard} stop${toBoard === 1 ? "" : "s"} away${kmToBoard != null ? ` · ${kmToBoard} km` : ""}`}
                </p>
                <p className="text-xs text-muted">
                  Expected {fmt12(boardStn.etd || boardStn.eta || boardStn.std || boardStn.sta)}
                  {boardStn.platform ? ` · Platform ${boardStn.platform}` : ""}
                </p>
              </div>
            )}
            {destStn && (
              <div className="border-t border-line p-4 sm:border-t-0 sm:border-l">
                <p className="text-xs text-muted">Your destination · {destStn.name}</p>
                <p className="mt-0.5 font-semibold">Arrives {fmt12(destStn.eta || destStn.sta)}</p>
                <p className="text-xs text-muted">Scheduled {fmt12(destStn.sta)}{destStn.platform ? ` · Platform ${destStn.platform}` : ""}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Timeline */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-semibold tracking-tight">Route</h2>
            <p className="text-xs text-muted">
              {stations.length} stops{run.kmTotal ? ` · ${run.kmTotal} km` : ""}
              {run.fromSchedule ? " · scheduled timings" : " · live"}
            </p>
          </div>
          {run.fromSchedule && (
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-muted">
              {run.liveDown ? "Live feed unavailable" : "Live positions start when the train departs"}
            </span>
          )}
        </div>
        {stations.length === 0 && <p className="px-5 py-6 text-sm text-muted">Route details aren&apos;t available for this train yet.</p>}
        <ol className="py-2">
          {stations.map((s, i) => {
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
            return (
              <li key={`${s.code || s.name}-${i}`}>
                {newDay && (
                  <div className="grid grid-cols-[68px_28px_1fr] items-center gap-2 px-4 py-1 sm:grid-cols-[88px_32px_1fr] sm:gap-3 sm:px-5">
                    <span />
                    <span className="mx-auto h-4 w-0.5 bg-line" />
                    <span className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
                      Day {(s.day ?? 0) + (stations[0].day === 1 ? 0 : 1)}
                      <span className="h-px flex-1 bg-line" />
                    </span>
                  </div>
                )}
                <div className={`grid grid-cols-[68px_28px_1fr] gap-2 px-4 transition sm:grid-cols-[88px_32px_1fr] sm:gap-3 sm:px-5 ${here ? "bg-info-soft/60" : mine ? "bg-accent-soft/50" : "hover:bg-surface-2/60"}`}>
                  {/* times */}
                  <div className="py-3 text-right tabular-nums">
                    {first ? (
                      <p className={`text-sm font-semibold ${passed ? "text-muted" : ""}`}>{fmt12(dep) || "—"}</p>
                    ) : (
                      <p className={`text-sm font-semibold ${passed ? "text-muted" : ""}`}>{fmt12(arr) || "—"}</p>
                    )}
                    {!first && s.eta && s.sta && s.eta !== s.sta && <p className="text-[11px] text-muted line-through">{fmt12(s.sta)}</p>}
                    {!first && !last && dep && dep !== arr && <p className="text-[11px] text-muted">dep {fmt12(dep)}</p>}
                    {first && <p className="text-[11px] text-muted">Starts</p>}
                    {last && <p className="text-[11px] text-muted">Ends</p>}
                  </div>

                  {/* rail */}
                  <div className="relative flex justify-center">
                    {!first && <span className={`absolute top-0 h-1/2 w-[3px] rounded-b ${lineTop}`} />}
                    {!last && <span className={`absolute bottom-0 h-1/2 w-[3px] rounded-t ${lineBottom}`} />}
                    <span className="relative z-10 self-center">
                      {here ? (
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
                  <div className="flex min-w-0 flex-col items-start gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <p className={`truncate ${mine || here || first || last ? "font-semibold" : "font-medium"} ${passed && !here ? "text-muted" : ""}`}>
                        {s.name}
                        {s.code && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 align-middle font-mono text-[10px] font-medium text-muted">{s.code}</span>}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted">
                        {s.platform && <span className="rounded border border-line px-1.5 font-medium">PF {s.platform}</span>}
                        {s.km != null && <span>{s.km} km</span>}
                        {halt && <span>{halt}m halt</span>}
                        {s.delay != null && s.delay > 0 && <span className="rounded bg-warn-soft px-1.5 font-semibold text-warn">+{s.delay} min</span>}
                        {here && (
                          <span className="font-semibold text-info">
                            {run.started ? "Train is here" : `Waiting to depart${s.std ? ` · ${fmt12(s.std)}` : ""}`}
                          </span>
                        )}
                      </div>
                    </div>
                    {mine && (
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${passed ? "bg-surface-2 text-muted" : "bg-accent text-accent-ink"}`}>
                        {isB ? "Board here" : "Get down here"}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="border-t border-line px-5 py-3 text-[11px] text-muted">
          {run.fromSchedule ? "Timetable" : `Live data from ${state.provider}`}. Crowd-sourced running status may vary; confirm at the station. Refreshes every minute.
        </p>
      </section>
    </div>
  );
}
