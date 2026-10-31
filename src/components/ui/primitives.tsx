import Link from "next/link";
import type { ReactNode } from "react";
import { AlertIcon, CheckIcon, InfoIcon } from "./icons";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-8">
      {back ? (
        <Link href={back.href} className="mb-2 inline-block text-sm text-ink-muted hover:text-primary">
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {description ? <div className="mt-1 text-sm text-ink-muted">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className = "",
  flush = false,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={`card ${className}`}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={flush ? "" : "p-6"}>{children}</div>
    </section>
  );
}

const BADGE = {
  neutral: "bg-surface text-ink-muted",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger-ink",
  info: "bg-info-soft text-info-ink",
} as const;
export type BadgeTone = keyof typeof BADGE;

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1 rounded-sm px-2 text-xs font-medium whitespace-nowrap ${BADGE[tone]}`}
    >
      {children}
    </span>
  );
}

const ALERT = {
  info: { cls: "border-info-ink/20 bg-info-soft text-info-ink", Icon: InfoIcon },
  success: { cls: "border-success-ink/20 bg-success-soft text-success-ink", Icon: CheckIcon },
  warning: { cls: "border-warning-ink/20 bg-warning-soft text-warning-ink", Icon: AlertIcon },
  danger: { cls: "border-danger-ink/20 bg-danger-soft text-danger-ink", Icon: AlertIcon },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: keyof typeof ALERT;
  title?: string;
  children?: ReactNode;
}) {
  const { cls, Icon } = ALERT[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex gap-2 rounded-md border px-4 py-2 text-sm ${cls}`}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5" : ""}>{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-line-strong px-6 py-8 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone?: "danger" | "warning" | "primary";
  hint?: string;
}) {
  const color =
    value === 0 || !tone
      ? "text-ink"
      : { danger: "text-danger-ink", warning: "text-warning-ink", primary: "text-primary" }[tone];
  return (
    <div className="px-6 py-4">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className={`mt-1 text-2xl font-semibold tabular ${color}`}>{value}</dd>
      {hint ? <p className="text-xs text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
  label,
}: {
  value: number;
  tone?: "primary" | "warning" | "danger";
  label?: string;
}) {
  const color = { primary: "bg-primary", warning: "bg-accent", danger: "bg-danger-ink" }[tone];
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface"
      role="progressbar"
      aria-label={label}
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-full ${color}`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

/** Table primitives: readable defaults (left-aligned text, right-aligned numbers, sticky-ish header). */
export function Table({ children, label, minWidth = 720 }: { children: ReactNode; label: string; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}
export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`border-b border-line bg-canvas px-4 py-2 text-xs font-medium tracking-wide text-ink-muted uppercase first:pl-6 last:pr-6 ${className}`}
    >
      {children}
    </th>
  );
}
export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`border-b border-line px-4 py-4 align-top first:pl-6 last:pr-6 ${className}`}>{children}</td>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface ${className}`} />;
}
