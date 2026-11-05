import PassengerForm from "@/components/PassengerForm";
import { Empty } from "@/components/ui";
import { deletePassenger } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { BERTH_LABELS } from "@/lib/data";
import { db } from "@/lib/db";

export const metadata = { title: "Passengers" };

const GENDER = { M: "Male", F: "Female", T: "Transgender" };

export default async function PassengersPage() {
  const user = await requireUser("/passengers");
  const list = db.prepare("SELECT * FROM passengers WHERE user_id = ? ORDER BY name").all(user.id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Saved passengers</h1>
        <p className="mt-1 text-sm text-muted">Add once, pick with one tap while booking.</p>
      </div>
      <PassengerForm />
      {list.length === 0 ? (
        <Empty title="No saved passengers yet" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <li key={p.id} className="card flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-muted">
                  {p.age} · {GENDER[p.gender]} · {p.berth_pref === "NP" ? "No preference" : BERTH_LABELS[p.berth_pref]}
                </p>
              </div>
              <form action={deletePassenger}>
                <input type="hidden" name="id" value={p.id} />
                <button className="btn-ghost py-1.5 text-muted" aria-label={`Remove ${p.name}`}>Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
