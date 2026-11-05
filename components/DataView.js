import { inr } from "./ui";

// Renders any JSON payload readably: objects → key/value grid, arrays of
// records → tables. Provider-agnostic, so it survives response shape changes.

const human = (k) =>
  String(k)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());

const isPrim = (v) => v == null || ["string", "number", "boolean"].includes(typeof v);

const MONEY_KEY = /fare|amount|price|charge|refund|fee|total.?cost/i;
const show = (v, key = "") => {
  if (v == null || v === "") return "-";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (MONEY_KEY.test(key) && v !== "" && !Number.isNaN(Number(v))) return inr(v);
  return String(v);
};

function Table({ rows }) {
  const cols = [];
  for (const r of rows.slice(0, 50)) for (const [k, v] of Object.entries(r)) if (isPrim(v) && !cols.includes(k)) cols.push(k);
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left text-xs text-muted">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 font-medium whitespace-nowrap">{human(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {cols.map((c) => (
                <td key={c} className="px-3 py-2 whitespace-nowrap">{show(r[c], c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DataView({ data, depth = 0 }) {
  if (isPrim(data)) return <p className="text-sm">{show(data)}</p>;
  if (depth > 4) return <pre className="overflow-x-auto text-xs text-muted">{JSON.stringify(data, null, 2)}</pre>;

  if (Array.isArray(data)) {
    if (!data.length) return <p className="text-sm text-muted">No results.</p>;
    if (data.every((x) => x && typeof x === "object" && !Array.isArray(x))) return <Table rows={data} />;
    return (
      <ul className="space-y-2">
        {data.map((x, i) => (
          <li key={i}><DataView data={x} depth={depth + 1} /></li>
        ))}
      </ul>
    );
  }

  const entries = Object.entries(data);
  const flat = entries.filter(([, v]) => isPrim(v));
  const nested = entries.filter(([, v]) => !isPrim(v));
  return (
    <div className="space-y-5">
      {flat.length > 0 && (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {flat.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted">{human(k)}</dt>
              <dd className="truncate font-medium" title={show(v, k)}>{show(v, k)}</dd>
            </div>
          ))}
        </dl>
      )}
      {nested.map(([k, v]) => (
        <section key={k}>
          <h3 className="mb-2 text-sm font-semibold">{human(k)}</h3>
          <DataView data={v} depth={depth + 1} />
        </section>
      ))}
    </div>
  );
}
