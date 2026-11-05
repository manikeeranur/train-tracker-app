import { BERTH_LABELS } from "@/lib/data";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
// 1320 → "₹1,320.00", 1280.567 → "₹1,280.57"
export const inr = (n) => INR.format(Number(n));

const STATUS = {
  SCHEDULED: ["Auto-book scheduled", "bg-info-soft text-info"],
  PROCESSING: ["Processing", "bg-info-soft text-info"],
  CONFIRMED: ["Confirmed", "bg-accent-soft text-accent"],
  WAITLIST: ["Waitlisted", "bg-warn-soft text-warn"],
  CANCELLED: ["Cancelled", "bg-surface-2 text-muted"],
  FAILED: ["Failed", "bg-danger-soft text-danger"],
};

export function StatusBadge({ status }) {
  const [label, cls] = STATUS[status] ?? [status, "bg-surface-2 text-muted"];
  return <span className={`chip ${cls}`}>{label}</span>;
}

export function PaxStatus({ p }) {
  if (p.status === "CNF") {
    if (!p.coach) return <span className="text-muted">No berth (child)</span>;
    return (
      <span className="font-mono font-semibold text-accent">
        CNF / {p.coach} / {p.berth_no} <span className="font-sans font-normal text-muted">· {BERTH_LABELS[p.berth_type]}</span>
      </span>
    );
  }
  if (p.status === "WL") return <span className="font-mono font-semibold text-warn">WL {p.wl_no}</span>;
  if (p.status === "CAN") return <span className="text-muted">Cancelled</span>;
  return <span className="text-muted">Pending</span>;
}

export function Availability({ c }) {
  if (c.closed) return <span className="text-sm font-semibold text-muted">Closed</span>;
  if (c.notYetOpen) return <span className="text-sm font-semibold text-info">Opens later</span>;
  if (c.free > 0) return <span className="text-sm font-semibold text-accent">AVL {c.free}</span>;
  return <span className="text-sm font-semibold text-warn">WL {c.wl + 1}</span>;
}

export function Empty({ title, children }) {
  return (
    <div className="card px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}
