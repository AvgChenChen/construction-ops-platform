import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Filters are a plain GET form, so they work without JavaScript and the URL is shareable.
 * The filtering itself happens on the server.
 */
export function FilterBar({
  action,
  children,
  clearHref,
  summary,
}: {
  action: string;
  children: ReactNode;
  clearHref: string;
  summary?: ReactNode;
}) {
  return (
    <form
      action={action}
      method="get"
      className="flex flex-wrap items-end gap-4 border-b border-line px-6 py-4"
      role="search"
    >
      {children}
      <div className="flex items-center gap-2">
        <button type="submit" className="btn-secondary">
          Apply
        </button>
        <Link href={clearHref} className="btn-ghost">
          Clear
        </Link>
      </div>
      {summary ? <p className="ml-auto self-center text-sm text-ink-subtle">{summary}</p> : null}
    </form>
  );
}

export function FilterSelect({
  id,
  name,
  label,
  value,
  options,
}: {
  id: string;
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="min-w-44">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} name={name} defaultValue={value ?? ""} className="input">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
