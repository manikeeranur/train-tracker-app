import Link from "next/link";
import BetweenResults from "@/components/BetweenResults";
import { isBetweenList } from "@/lib/between";
import DataView from "@/components/DataView";
import PnrResult from "@/components/PnrResult";
import FareResults, { isFareList } from "@/components/FareResults";
import StationInput from "@/components/StationInput";
import TrainSearch from "@/components/TrainSearch";
import { STATION_MAP } from "@/lib/data";
import { ENDPOINTS, PROVIDERS, SELECT_OPTIONS, fetchLive, isConfigured } from "@/lib/live";
import { addDays, todayIST } from "@/lib/time";

export const metadata = { title: "Live rail info" };

export default async function LivePage({ searchParams }) {
  const sp = await searchParams;
  const tab = ENDPOINTS[sp.tab] && !ENDPOINTS[sp.tab].hidden ? sp.tab : "running";
  const ep = ENDPOINTS[tab];
  const query = Object.fromEntries(ep.fields.map(([k]) => [k, String(sp[k] ?? "").trim().toUpperCase()]));
  const submitted = sp.go === "1";
  // Trains-between ignores the date upstream (date only filters running days here), so keep it out of the cache key.
  const fetchQuery =
    tab === "between" ? { from: query.from, to: query.to } : tab === "fare" ? { from: query.from, to: query.to, quota: query.quota || "GN" } : query;
  // Live running status has its own tracker page (/track/train), so no fetch here.
  const result = submitted && tab !== "running" ? await fetchLive(tab, fetchQuery) : null;
  const today = todayIST();
  // Seat availability for the chosen date (one call returns every train + class).
  const seatDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.date || "") ? sp.date : "";
  let avail = null;
  if (tab === "between" && submitted && seatDate && result && !result.error) {
    const a = await fetchLive("seats", { from: query.from, to: query.to, date: seatDate });
    avail = a.error ? { error: a.error } : { trains: Object.fromEntries((Array.isArray(a.data) ? a.data : []).map((t) => [String(t.trainNumber), t])) };
  }
  const defaultDate = addDays(todayIST(), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Live rail info</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Real Indian Railways data: PNR status, trains between stations, live running status and schedules.
        </p>
      </div>

      {!isConfigured() && (
        <div className="card space-y-2 border-warn/40 bg-warn-soft p-4 text-sm">
          <p className="font-semibold text-warn">API key needed</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>Sign up on rapidapi.com and subscribe to the free plans of: {Object.values(PROVIDERS).map((p) => p.name).join(", ")}.</li>
            <li>Create <code>irctc-app/.env.local</code> with <code>RAIL_API_KEY=your_key</code>.</li>
            <li>Rebuild and restart: <code>npm run build &amp;&amp; npm start</code>.</li>
          </ol>
        </div>
      )}

      <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-surface p-1">
        {Object.entries(ENDPOINTS).filter(([, e]) => !e.hidden).sort(([a], [b]) => (b === "running") - (a === "running")).map(([k, e]) => (
          <Link
            key={k}
            href={`/live?tab=${k}`}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium transition ${k === tab ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
          >
            {e.label}
          </Link>
        ))}
      </nav>

      {tab === "running" ? (
        <TrainSearch />
      ) : tab === "pnr" ? (
        <form className="mx-auto flex max-w-2xl flex-col gap-3 rounded-3xl bg-surface p-4 sm:flex-row sm:p-5">
          <input type="hidden" name="tab" value="pnr" />
          <input type="hidden" name="go" value="1" />
          <label htmlFor="f-pnr" className="sr-only">PNR number</label>
          <input
            id="f-pnr"
            name="pnr"
            defaultValue={sp.pnr || ""}
            inputMode="numeric"
            pattern="[0-9]{10}"
            maxLength={10}
            placeholder="Enter 10-digit PNR"
            autoComplete="off"
            required
            className="field flex-1 py-3.5 text-center font-mono text-xl tracking-[0.2em] sm:text-left"
          />
          <button className="btn-primary px-8 py-3.5 text-base">Check status</button>
        </form>
      ) : (
      <form className="grid gap-3 rounded-2xl bg-surface p-4 sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))] sm:items-end">
        <input type="hidden" name="tab" value={tab} />
        <input type="hidden" name="go" value="1" />
        {ep.fields.map(([k, label, ph, type]) =>
          ["from", "to", "code"].includes(k) ? (
            <StationInput
              key={k}
              name={k}
              label={k === "from" ? "From" : k === "to" ? "To" : "Station"}
              defaultCode={query[k]}
              defaultName={STATION_MAP[query[k]]?.name || ""}
              placeholder={k === "to" ? "e.g. Trichy" : "e.g. Chennai Egmore"}
              required={!ep.optional?.includes(k)}
            />
          ) : type === "select" ? (
            <div key={k}>
              <label className="label" htmlFor={`f-${k}`}>{label}</label>
              <select id={`f-${k}`} name={k} defaultValue={query[k] || SELECT_OPTIONS[k][0][0]} className="field">
                {SELECT_OPTIONS[k].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          ) : (
          <div key={k}>
            <label className="label" htmlFor={`f-${k}`}>{label}</label>
            <input
              id={`f-${k}`}
              name={k}
              type={type || "text"}
              defaultValue={type === "date" ? (sp[k] || defaultDate) : sp[k] || ""}
              placeholder={ph}
              className={`field ${type ? "" : "font-mono uppercase"}`}
              required={!ep.optional?.includes(k)}
            />
          </div>
          )
        )}
        <button className="btn-primary py-3">Fetch</button>
      </form>
      )}

      {result?.error && (
        <div className="space-y-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
          <p>{result.error}</p>
          {result.attempts?.length > 0 && (
            <ul className="list-disc pl-5 text-xs">
              {result.attempts.map((a) => <li key={a}>{a}</li>)}
            </ul>
          )}
          {result.raw && (
            <details>
              <summary className="cursor-pointer text-xs">Provider response</summary>
              <pre className="mt-2 overflow-x-auto text-xs">{typeof result.raw === "string" ? result.raw : JSON.stringify(result.raw, null, 2)}</pre>
            </details>
          )}
        </div>
      )}

      {result && !result.error && tab === "between" && isBetweenList(result.data) && (
        <section className="space-y-3">
          <BetweenResults data={result.data} query={query} today={today} initialDate={seatDate} avail={avail} />
          <p className="text-right text-[11px] text-muted">
            Source: {result.provider} · {result.cached ? "from cache" : `fetched in ${result.ms} ms`}
          </p>
        </section>
      )}

      {result && !result.error && tab === "pnr" && (
        <div className="mx-auto max-w-2xl">
          <PnrResult pnr={query.pnr} data={result.data} provider={result.provider} cached={result.cached} ms={result.ms} />
        </div>
      )}

      {result && !result.error && tab === "fare" && isFareList(result.data) && <FareResults data={result.data} query={query} />}

      {result && !result.error && tab !== "pnr" && !(tab === "between" && isBetweenList(result.data)) && !(tab === "fare" && isFareList(result.data)) && (
        <section className="card space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>Source: {result.provider}</span>
            <span>{result.cached ? "From cache" : `Fetched in ${result.ms} ms`}</span>
          </div>
          <DataView data={result.data} />
          <details className="border-t border-line pt-3">
            <summary className="cursor-pointer text-xs text-muted">Raw JSON</summary>
            <pre className="mt-2 max-h-96 overflow-auto text-xs">{JSON.stringify(result.data, null, 2)}</pre>
          </details>
        </section>
      )}
    </div>
  );
}
