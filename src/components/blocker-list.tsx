import Link from "next/link";
import type { Blocker } from "@/lib/domain/blockers";
import { RiskBadge } from "./ui/status";
import { EmptyState } from "./ui/primitives";

type Row = Blocker & { projectId: string; projectName?: string };

export function BlockerList({
  blockers,
  showProject = false,
  emptyTitle,
}: {
  blockers: Row[];
  showProject?: boolean;
  emptyTitle?: string;
}) {
  if (blockers.length === 0) {
    return (
      <EmptyState title={emptyTitle ?? "Nothing is blocked or at risk"}>
        Tasks appear here when they should have started but are waiting on unfinished work, have a blocking issue, or
        are running late.
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-line" data-testid="blocker-list">
      {blockers.map((b) => (
        <li key={b.taskId} className="py-4 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge level={b.level} />
            <Link
              href={`/projects/${b.projectId}/tasks/${b.taskId}`}
              className="font-medium text-ink hover:text-primary hover:underline"
            >
              {b.taskName}
            </Link>
            {showProject && b.projectName ? <span className="text-sm text-ink-subtle">· {b.projectName}</span> : null}
          </div>
          <ul className="mt-2 space-y-1 text-sm text-ink-muted">
            {b.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
