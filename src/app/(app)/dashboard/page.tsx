import Link from "next/link";
import { formatDate } from "@/lib/domain/calendar";
import { appToday } from "@/lib/today";
import { ActivityFeed } from "@/components/activity-feed";
import { BlockerList } from "@/components/blocker-list";
import { FollowUpReview } from "@/components/follow-up-review";
import { PlusIcon } from "@/components/ui/icons";
import { Card, EmptyState, Metric, PageHeader, ProgressBar } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/current";
import { getDashboard } from "@/server/services/dashboard";

export const metadata = { title: "Dashboard" };

const VIEWS = [
  { key: "all", label: "All" },
  { key: "blocked", label: "Blocked" },
  { key: "at_risk", label: "At risk" },
] as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser();
  const today = appToday();
  const [data, params] = await Promise.all([getDashboard(user, today), searchParams]);
  const show = VIEWS.find((v) => v.key === params.show)?.key ?? "all";
  const shown = show === "all" ? data.blockers : data.blockers.filter((b) => b.level === show);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${user.organizationName} · ${formatDate(today)}`}
        actions={
          <Link href="/projects/new" className="btn-primary">
            <PlusIcon /> New project
          </Link>
        }
      />

      <dl className="card mb-6 grid grid-cols-2 divide-line sm:grid-cols-3 sm:divide-x lg:grid-cols-5">
        <Metric label="Active projects" value={data.stats.activeProjects} />
        <Metric label="Blocked tasks" value={data.stats.blocked} tone="danger" />
        <Metric label="At-risk tasks" value={data.stats.atRisk} tone="warning" hint="Next 5 working days" />
        <Metric label="Open issues" value={data.stats.openIssues} />
        <Metric label="Awaiting approval" value={data.stats.pendingApprovals} tone="primary" />
      </dl>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Needs attention"
            description="Computed from task dependencies, open blocking issues, and planned dates."
            actions={
              <nav aria-label="Filter blockers" className="flex rounded-md border border-line p-0.5">
                {VIEWS.map((v) => (
                  <Link
                    key={v.key}
                    href={v.key === "all" ? "/dashboard" : `/dashboard?show=${v.key}`}
                    aria-current={show === v.key ? "true" : undefined}
                    className={`rounded-sm px-3 py-1 text-sm ${show === v.key ? "bg-primary-soft font-medium text-primary" : "text-ink-muted hover:text-ink"}`}
                  >
                    {v.label}
                  </Link>
                ))}
              </nav>
            }
          >
            <BlockerList
              blockers={shown}
              showProject
              emptyTitle={show === "all" ? undefined : `No ${show === "blocked" ? "blocked" : "at-risk"} tasks`}
            />
          </Card>

          <Card title="Active projects">
            {data.projects.length === 0 ? (
              <EmptyState
                title="No active projects"
                action={
                  <Link href="/projects/new" className="btn-primary">
                    Create a project
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {data.projects.map((p) => {
                  const blocked = p.blockers.filter((b) => b.level === "blocked").length;
                  const atRisk = p.blockers.length - blocked;
                  return (
                    <li key={p.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-4">
                        <Link href={`/projects/${p.id}`} className="font-medium hover:text-primary hover:underline">
                          {p.name}
                        </Link>
                        <span className="text-sm text-ink-muted tabular">{p.progress}%</span>
                      </div>
                      <p className="text-sm text-ink-subtle">{p.address}</p>
                      <div className="mt-2">
                        <ProgressBar
                          value={p.progress}
                          tone={blocked ? "danger" : atRisk ? "warning" : "primary"}
                          label={`${p.name} progress`}
                        />
                      </div>
                      <p className="mt-2 text-xs text-ink-subtle tabular">
                        {p.completeCount} of {p.taskCount} tasks complete · {blocked} blocked · {atRisk} at risk ·{" "}
                        {p.openIssues} open issues
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Follow-ups awaiting approval" description="Nothing is sent from this app. Approval is recorded.">
            {data.pendingFollowUps.length === 0 ? (
              <EmptyState title="Nothing waiting for approval" />
            ) : (
              <ul className="space-y-4" data-testid="pending-follow-ups">
                {data.pendingFollowUps.map((f) => (
                  <li key={f.id} className="rounded-md border border-line p-4">
                    <p className="text-sm text-ink">{f.message}</p>
                    <p className="mt-2 text-xs text-ink-subtle">
                      {f.subcontractor ? `To ${f.subcontractor.companyName} · ` : ""}
                      <Link href={`/projects/${f.project.id}`} className="hover:text-primary hover:underline">
                        {f.project.name}
                      </Link>
                      {f.createdBy ? ` · drafted by ${f.createdBy.name}` : ""}
                    </p>
                    <div className="mt-4">
                      <FollowUpReview followUpId={f.id} canReview={user.role === "OWNER"} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Recent activity">
            <ActivityFeed items={data.recentActivity} showProject />
          </Card>
        </div>
      </div>
    </>
  );
}
