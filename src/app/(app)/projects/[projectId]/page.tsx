import Link from "next/link";
import {
  addProjectSubcontractorAction,
  createFollowUpAction,
  createIssueAction,
  createTaskAction,
  removeProjectSubcontractorAction,
  resolveIssueAction,
  setProjectArchivedAction,
} from "@/app/actions";
import { ActivityFeed } from "@/components/activity-feed";
import { BlockerList } from "@/components/blocker-list";
import { FilterBar, FilterSelect } from "@/components/filter-bar";
import { FollowUpReview } from "@/components/follow-up-review";
import { ScheduleTable } from "@/components/schedule-table";
import { TaskFields } from "@/components/task-fields";
import { ConfirmButton, FormDialog } from "@/components/ui/dialog";
import { ActionButton, ActionForm } from "@/components/ui/forms";
import { DownloadIcon, PlusIcon } from "@/components/ui/icons";
import { Alert, Badge, Card, EmptyState, Field, PageHeader, ProgressBar } from "@/components/ui/primitives";
import { FollowUpStatusBadge, SeverityBadge } from "@/components/ui/status";
import { detectBlockers, projectProgress } from "@/lib/domain/blockers";
import { formatDate } from "@/lib/domain/calendar";
import { FOLLOW_UP_STATUS_LABELS, TRADE_LABELS } from "@/lib/domain/trades";
import { appToday } from "@/lib/today";
import { orNotFound, requireUser } from "@/server/auth/current";
import { getProjectDetail } from "@/server/services/projects";
import { listSubcontractors } from "@/server/services/subcontractors";

const STATUS_FILTERS = [
  { value: "", label: "All tasks" },
  { value: "open", label: "Not complete" },
  { value: "attention", label: "Blocked or at risk" },
  { value: "complete", label: "Complete" },
];

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string; trade?: string }>;
}) {
  const user = await requireUser();
  const { projectId } = await params;
  const filters = await searchParams;
  const [project, directory] = await Promise.all([
    orNotFound(getProjectDetail(user, projectId)),
    listSubcontractors(user),
  ]);
  const today = appToday();
  const archived = project.status === "ARCHIVED";
  const isOwner = user.role === "OWNER";

  const blockers = detectBlockers(
    project.tasks.map((t) => ({ ...t, dependsOn: t.dependencies.map((d) => d.dependsOnId) })),
    project.issues,
    today,
  );
  const flagged = new Set(blockers.map((b) => b.taskId));
  const rows = project.tasks.filter((t) => {
    if (filters.trade && t.trade !== filters.trade) return false;
    if (filters.status === "open") return t.status !== "COMPLETE";
    if (filters.status === "complete") return t.status === "COMPLETE";
    if (filters.status === "attention") return flagged.has(t.id);
    return true;
  });
  const tradesInUse = [...new Set(project.tasks.map((t) => t.trade))];

  const progress = projectProgress(project.tasks);
  const projectSubs = project.subcontractors.map((ps) => ps.subcontractor);
  const onProject = new Set(projectSubs.map((s) => s.id));
  const available = directory.filter((s) => !onProject.has(s.id));
  const subOptions = projectSubs.length > 0 ? projectSubs : directory;
  const openIssues = project.issues.filter((i) => i.status === "OPEN");
  const plannedFinish = project.tasks.reduce<Date | null>((m, t) => (!m || t.plannedEnd > m ? t.plannedEnd : m), null);
  const late = project.targetEndDate && plannedFinish && plannedFinish > project.targetEndDate;

  return (
    <>
      <PageHeader
        title={project.name}
        back={{ href: "/projects", label: "Projects" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {project.address}
            {project.clientName ? <span>Client: {project.clientName}</span> : null}
            {archived ? <Badge>Archived</Badge> : <Badge tone="success">Active</Badge>}
          </span>
        }
        actions={
          <>
            <a
              href={`/api/projects/${project.id}/schedule-export`}
              className="btn-secondary"
              target="_blank"
              rel="noreferrer"
            >
              <DownloadIcon /> Schedule JSON
            </a>
            {!archived ? (
              <Link href={`/projects/${project.id}/edit`} className="btn-secondary">
                Edit
              </Link>
            ) : null}
            {isOwner ? (
              archived ? (
                <ActionButton
                  action={setProjectArchivedAction.bind(null, project.id, false)}
                  label="Restore project"
                  className="btn-primary"
                />
              ) : (
                <ConfirmButton
                  action={setProjectArchivedAction.bind(null, project.id, true)}
                  label="Archive"
                  triggerClassName="btn-danger"
                  title="Archive this project?"
                  description="Archived projects are read-only and hidden from the dashboard. An owner can restore it later."
                  confirmLabel="Archive project"
                />
              )
            ) : null}
          </>
        }
      />

      {archived ? (
        <div className="mb-6">
          <Alert tone="info" title="This project is archived and read-only.">
            {isOwner ? "Restore it to make changes." : "Ask an account owner to restore it."}
          </Alert>
        </div>
      ) : null}

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card title="Blockers and risks" className="lg:col-span-2">
          <BlockerList blockers={blockers.map((b) => ({ ...b, projectId: project.id }))} />
        </Card>
        <Card title="Summary">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-ink-muted">Progress (duration-weighted)</span>
            <span className="font-medium tabular">{progress}%</span>
          </div>
          <ProgressBar value={progress} label="Project progress" />
          <dl className="mt-6 space-y-2 text-sm">
            {[
              ["Start", formatDate(project.startDate)],
              ["Target completion", formatDate(project.targetEndDate)],
              ["Planned finish (from tasks)", formatDate(plannedFinish)],
              [
                "Tasks complete",
                `${project.tasks.filter((t) => t.status === "COMPLETE").length} of ${project.tasks.length}`,
              ],
              ["Open issues", String(openIssues.length)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="text-right font-medium tabular">{v}</dd>
              </div>
            ))}
          </dl>
          {late ? (
            <div className="mt-4">
              <Alert tone="warning">Planned finish is after the target completion date.</Alert>
            </div>
          ) : null}
          {project.description ? (
            <p className="mt-6 border-t border-line pt-4 text-sm text-ink-muted">{project.description}</p>
          ) : null}
        </Card>
      </div>

      <Card
        title="Schedule"
        className="mb-6"
        flush
        actions={
          !archived ? (
            <FormDialog
              trigger={
                <>
                  <PlusIcon /> Add task
                </>
              }
              title="Add task"
              description="Planned finish is calculated from the start date and working-day duration."
              size="lg"
            >
              <ActionForm
                action={createTaskAction.bind(null, project.id)}
                submitLabel="Add task"
                pendingLabel="Adding…"
              >
                <TaskFields
                  idPrefix="new-task"
                  subcontractors={subOptions}
                  predecessors={project.tasks.map((t) => ({ id: t.id, name: t.name }))}
                />
              </ActionForm>
            </FormDialog>
          ) : null
        }
      >
        <FilterBar
          action={`/projects/${project.id}`}
          clearHref={`/projects/${project.id}`}
          summary={`Showing ${rows.length} of ${project.tasks.length} tasks`}
        >
          <FilterSelect id="f-status" name="status" label="Status" value={filters.status} options={STATUS_FILTERS} />
          <FilterSelect
            id="f-trade"
            name="trade"
            label="Trade"
            value={filters.trade}
            options={[
              { value: "", label: "All trades" },
              ...tradesInUse.map((t) => ({ value: t, label: TRADE_LABELS[t] })),
            ]}
          />
        </FilterBar>
        <ScheduleTable projectId={project.id} rows={rows} allTasks={project.tasks} blockers={blockers} today={today} />
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card
          title={`Issues (${openIssues.length} open)`}
          id="issues"
          actions={
            !archived ? (
              <FormDialog trigger="Log issue" triggerClassName="btn-secondary btn-sm" title="Log an issue">
                <ActionForm
                  action={createIssueAction.bind(null, project.id)}
                  submitLabel="Open issue"
                  pendingLabel="Saving…"
                >
                  <Field label="Title" htmlFor="issue-title">
                    <input id="issue-title" name="title" required className="input" />
                  </Field>
                  <Field label="Details (optional)" htmlFor="issue-details">
                    <textarea id="issue-details" name="details" rows={3} className="textarea" />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Severity" htmlFor="issue-severity">
                      <select id="issue-severity" name="severity" defaultValue="MEDIUM" className="input">
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                      </select>
                    </Field>
                    <Field label="Related task" htmlFor="issue-task">
                      <select id="issue-task" name="taskId" defaultValue="" className="input">
                        <option value="">Project-wide</option>
                        {project.tasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="isBlocker" className="size-4 accent-primary" /> This stops the related
                    task from progressing
                  </label>
                </ActionForm>
              </FormDialog>
            ) : null
          }
        >
          {project.issues.length === 0 ? (
            <EmptyState title="No issues logged" />
          ) : (
            <ul className="divide-y divide-line">
              {project.issues.map((i) => (
                <li key={i.id} className={`py-4 first:pt-0 last:pb-0 ${i.status === "RESOLVED" ? "opacity-70" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{i.title}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <SeverityBadge severity={i.severity} />
                    {i.isBlocker && i.status === "OPEN" ? <Badge tone="danger">Blocking</Badge> : null}
                    {i.status === "RESOLVED" ? <Badge tone="success">Resolved</Badge> : null}
                  </div>
                  {i.details ? <p className="mt-2 text-sm text-ink-muted">{i.details}</p> : null}
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-ink-subtle">
                    <span>{i.task ? `Task: ${i.task.name}` : "Project-wide"}</span>
                    {i.status === "OPEN" && !archived ? (
                      <ActionButton
                        action={resolveIssueAction.bind(null, i.id)}
                        label="Mark resolved"
                        pendingLabel="Resolving"
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Follow-ups"
          id="follow-ups"
          description="Drafts need owner approval. Nothing is sent automatically."
          actions={
            !archived ? (
              <FormDialog
                trigger="Draft follow-up"
                triggerClassName="btn-secondary btn-sm"
                title="Draft a follow-up"
                description="An owner must approve it before anyone acts on it."
              >
                <ActionForm
                  action={createFollowUpAction.bind(null, project.id)}
                  submitLabel="Submit for approval"
                  pendingLabel="Submitting…"
                >
                  <Field label="Message" htmlFor="fu-message">
                    <textarea id="fu-message" name="message" rows={4} required className="textarea" />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Subcontractor" htmlFor="fu-sub">
                      <select id="fu-sub" name="subcontractorId" defaultValue="" className="input">
                        <option value="">None</option>
                        {subOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.companyName}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Task" htmlFor="fu-task">
                      <select id="fu-task" name="taskId" defaultValue="" className="input">
                        <option value="">None</option>
                        {project.tasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Due" htmlFor="fu-due">
                      <input id="fu-due" name="dueDate" type="date" className="input" />
                    </Field>
                  </div>
                </ActionForm>
              </FormDialog>
            ) : null
          }
        >
          {project.followUps.length === 0 ? (
            <EmptyState title="No follow-ups yet" />
          ) : (
            <ul className="divide-y divide-line">
              {project.followUps.map((f) => (
                <li key={f.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm text-ink">{f.message}</p>
                    <FollowUpStatusBadge status={f.status} />
                  </div>
                  <p className="mt-2 text-xs text-ink-subtle">
                    {[
                      f.subcontractor ? `To ${f.subcontractor.companyName}` : null,
                      f.task ? `Re: ${f.task.name}` : null,
                      f.dueDate ? `Due ${formatDate(f.dueDate)}` : null,
                      f.createdBy ? `Drafted by ${f.createdBy.name}` : null,
                      f.reviewedBy ? `${FOLLOW_UP_STATUS_LABELS[f.status]} by ${f.reviewedBy.name}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {f.status === "PENDING_APPROVAL" && !archived ? (
                    <div className="mt-2">
                      <FollowUpReview followUpId={f.id} canReview={isOwner} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Subcontractors on this project (${projectSubs.length})`}>
          {projectSubs.length === 0 ? (
            <EmptyState title="No subcontractors added yet" />
          ) : (
            <ul className="divide-y divide-line">
              {projectSubs.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 py-2 first:pt-0">
                  <div>
                    <div className="font-medium">{s.companyName}</div>
                    <div className="text-xs text-ink-subtle">
                      {TRADE_LABELS[s.trade]} · {s.contactName}
                    </div>
                  </div>
                  {!archived ? (
                    <ConfirmButton
                      action={removeProjectSubcontractorAction.bind(null, project.id, s.id)}
                      label="Remove"
                      title={`Remove ${s.companyName}?`}
                      description="They stay in your company directory. Tasks already assigned to them keep the assignment."
                      confirmLabel="Remove from project"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {!archived && available.length > 0 ? (
            <div className="mt-6 border-t border-line pt-6">
              <ActionForm
                action={addProjectSubcontractorAction.bind(null, project.id)}
                submitLabel="Add to project"
                pendingLabel="Adding…"
                className="flex flex-wrap items-end gap-4"
              >
                <div className="min-w-56 flex-1">
                  <Field label="Add from your directory" htmlFor="add-sub">
                    <select id="add-sub" name="subcontractorId" defaultValue="" className="input">
                      <option value="" disabled>
                        Choose a subcontractor
                      </option>
                      {available.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.companyName} ({TRADE_LABELS[s.trade]})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </ActionForm>
            </div>
          ) : null}
        </Card>

        <Card title="Project activity">
          <ActivityFeed items={project.activity} />
        </Card>
      </div>
    </>
  );
}
