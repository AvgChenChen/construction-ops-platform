import { toISODate } from "@/lib/domain/calendar";
import { Field } from "./ui/primitives";

type Defaults = {
  name?: string;
  clientName?: string | null;
  address?: string;
  description?: string | null;
  startDate?: Date;
  targetEndDate?: Date | null;
};

export function ProjectFields({ defaults = {} }: { defaults?: Defaults }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Project name" htmlFor="name">
          <input
            id="name"
            name="name"
            required
            defaultValue={defaults.name}
            className="input"
            placeholder="e.g. Birchwood kitchen and bath renovation"
          />
        </Field>
      </div>
      <Field label="Site address" htmlFor="address">
        <input id="address" name="address" required defaultValue={defaults.address} className="input" />
      </Field>
      <Field label="Client (optional)" htmlFor="clientName">
        <input id="clientName" name="clientName" defaultValue={defaults.clientName ?? ""} className="input" />
      </Field>
      <Field label="Start date" htmlFor="startDate">
        <input
          id="startDate"
          name="startDate"
          type="date"
          required
          defaultValue={defaults.startDate ? toISODate(defaults.startDate) : ""}
          className="input"
        />
      </Field>
      <Field label="Target completion (optional)" htmlFor="targetEndDate">
        <input
          id="targetEndDate"
          name="targetEndDate"
          type="date"
          defaultValue={defaults.targetEndDate ? toISODate(defaults.targetEndDate) : ""}
          className="input"
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Scope notes (optional)" htmlFor="description">
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={defaults.description ?? ""}
            className="textarea"
          />
        </Field>
      </div>
    </div>
  );
}
