import Link from "next/link";
import { EmptyState } from "./ui/primitives";

type Item = {
  id: string;
  summary: string;
  createdAt: Date;
  actor: { name: string } | null;
  project?: { id: string; name: string } | null;
};

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function relative(date: Date) {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(seconds, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86400), "day");
}

export function ActivityFeed({ items, showProject = false }: { items: Item[]; showProject?: boolean }) {
  if (items.length === 0)
    return (
      <EmptyState title="No activity yet">
        Changes to projects, tasks, issues, and follow-ups are recorded here.
      </EmptyState>
    );
  return (
    <ol className="space-y-4" data-testid="activity-feed">
      {items.map((a) => (
        <li key={a.id} className="border-l-2 border-line pl-4 text-sm">
          <p className="text-ink">
            <span className="font-medium">{a.actor?.name ?? "System"}</span>{" "}
            <span className="text-ink-muted">{a.summary}</span>
          </p>
          <p className="mt-0.5 text-xs text-ink-subtle">
            <time dateTime={a.createdAt.toISOString()} title={a.createdAt.toISOString()}>
              {relative(a.createdAt)}
            </time>
            {showProject && a.project ? (
              <>
                {" · "}
                <Link href={`/projects/${a.project.id}`} className="hover:text-primary hover:underline">
                  {a.project.name}
                </Link>
              </>
            ) : null}
          </p>
        </li>
      ))}
    </ol>
  );
}
