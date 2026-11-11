// Train-number search for live running status. Plain GET form: works without JS.
export default function TrainSearch({ no = "", day = "0", compact = false }) {
  return (
    <form action="/track/train" className={`flex flex-col gap-2 rounded-2xl bg-surface p-3 sm:flex-row sm:items-end sm:gap-3 ${compact ? "" : "sm:p-5"}`}>
      <div className="flex-1">
        <label htmlFor="t-no" className="label">Train number</label>
        <input
          id="t-no"
          name="no"
          defaultValue={no}
          inputMode="numeric"
          pattern="[0-9]{5}"
          maxLength={5}
          placeholder="e.g. 12653"
          autoComplete="off"
          required
          className="field font-mono text-lg tracking-[0.2em]"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1 sm:w-44 sm:flex-none">
          <label htmlFor="t-day" className="label">Started</label>
          <select id="t-day" name="day" defaultValue={day} className="field">
            <option value="0">Today</option>
            <option value="1">Yesterday</option>
            <option value="2">2 days ago</option>
          </select>
        </div>
        <button className="btn-primary self-end px-6 py-3">Track</button>
      </div>
    </form>
  );
}
