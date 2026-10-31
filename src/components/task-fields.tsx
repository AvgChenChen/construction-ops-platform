import { toISODate } from "@/lib/domain/calendar";
import { TRADE_LABELS, TRADES } from "@/lib/domain/trades";
import { Field } from "./ui/primitives";

type Option = { id: string; name: string };

export function TaskFields({
  subcontractors,
  predecessors,
  defaults = {},
  idPrefix = "task",
}: {
  subcontractors: { id: string; companyName: string }[];
  predecessors?: Option[];
  defaults?: {
    name?: string;
    trade?: string;
    location?: string | null;
    subcontractorId?: string | null;
    plannedStart?: Date;
    durationDays?: number;
  };
  idPrefix?: string;
}) {
  const id = (s: string) => `${idPrefix}-${s}`;
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Field label="Task name" htmlFor={id("name")}>
        <input
          id={id("name")}
          name="name"
          required
          defaultValue={defaults.name}
          className="input"
          placeholder="e.g. Drywall hang and tape"
        />
      </Field>
      <Field label="Trade" htmlFor={id("trade")}>
        <select id={id("trade")} name="trade" required defaultValue={defaults.trade ?? ""} className="input">
          <option value="" disabled>
            Choose a trade
          </option>
          {TRADES.map((t) => (
            <option key={t} value={t}>
              {TRADE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Location (optional)" htmlFor={id("location")}>
        <input
          id={id("location")}
          name="location"
          defaultValue={defaults.location ?? ""}
          className="input"
          placeholder="e.g. 2nd floor"
        />
      </Field>
      <Field label="Subcontractor" htmlFor={id("sub")}>
        <select id={id("sub")} name="subcontractorId" defaultValue={defaults.subcontractorId ?? ""} className="input">
          <option value="">Unassigned</option>
          {subcontractors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.companyName}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Planned start" htmlFor={id("start")}>
        <input
          id={id("start")}
          name="plannedStart"
          type="date"
          required
          defaultValue={defaults.plannedStart ? toISODate(defaults.plannedStart) : ""}
          className="input"
        />
      </Field>
      <Field
        label="Duration (working days)"
        htmlFor={id("duration")}
        hint="Monday to Friday. The finish date is calculated."
      >
        <input
          id={id("duration")}
          name="durationDays"
          type="number"
          min={1}
          max={365}
          required
          defaultValue={defaults.durationDays ?? 1}
          className="input"
        />
      </Field>
      {predecessors && predecessors.length > 0 ? (
        <fieldset className="sm:col-span-2">
          <legend className="label">Can&apos;t start until these are complete</legend>
          <div className="grid gap-2 rounded-md border border-line p-4 sm:grid-cols-2">
            {predecessors.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="dependsOn" value={p.id} className="size-4 accent-primary" />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
