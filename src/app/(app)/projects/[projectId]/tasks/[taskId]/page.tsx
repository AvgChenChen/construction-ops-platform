import Link from "next/link";
import { notFound } from "next/navigation";
import { addDependencyAction, recordProgressAction, removeDependencyAction, updateTaskAction } from "@/app/actions";
import { TaskFields } from "@/components/task-fields";
import { ConfirmButton } from "@/components/ui/dialog";
import { ActionForm } from "@/components/ui/forms";
import { Alert, Badge, Card, EmptyState, Field, PageHeader, ProgressBar } from "@/components/ui/primitives";
import { SeverityBadge, TaskStatusBadge } from "@/components/ui/status";
import { formatDate } from "@/lib/domain/calendar";
import { STATUS_LABELS, TASK_STATUSES, TRADE_LABELS } from "@/lib/domain/trades";
import { orNotFound, requireUser } from "@/server/auth/current";
import { listSubcontractors } from "@/server/services/subcontractors";
import { getTaskDetail } from "@/server/services/tasks";

export default async function TaskPage({ params }: { params: Promise<{ projectId: string; taskId: string }> }) {
  const user = await requireUser();
  const { projectId, taskId } = await params;
  const [{ task, siblings }, directory] = await Promise.all([
    orNotFound(getTaskDetail(user, taskId)),
    listSubcontractors(user),
  ]);
  if (task.projectId !== projectId) notFound();
  const archived = task.project.status === "ARCHIVED";
  const existingDeps = new Set(task.dependencies.map((d) => d.dependsOnId));
  const candidates = siblings.filter((s) => !existingDeps.has(s.id));
  const waitingOn = task.dependencies.filter((d) => d.dependsOn.status !== "COMPLETE");

  return (
    <>
      <PageHeader
        title={task.name}
        back={{ href: `/projects/${projectId}`, label: task.project.name }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {TRADE_LABELS[task.trade]}
            {task.location ? ` · ${task.location}` : ""} · {task.subcontractor?.companyName ?? "Unassigned"}
            <TaskStatusBadge status={task.status} />
          </span>
        }
      />

      {archived ? (
        <div className="mb-6">
          <Alert tone="info" title="The project is archived, so this task is read-only." />
        </div>
      ) : waitingOn.length > 0 && task.status !== "COMPLETE" ? (
        <div className="mb-6">
          <Alert tone="warning" title="Waiting on unfinished work">
            {waitingOn.map((d) => `${d.dependsOn.name} (${d.dependsOn.percentComplete}%)`).join(", ")}
          </Alert>
        </div>
      ) : null}

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card title="Status">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-ink-muted">Complete</span>
            <span className="font-medium tabular">{task.percentComplete}%</span>
          </div>
          <ProgressBar value={task.percentComplete} label="Task progress" />
          <dl className="mt-6 space-y-2 text-sm">
            {[
              ["Planned start", formatDate(task.plannedStart)],
              ["Planned finish", formatDate(task.plannedEnd)],
              ["Duration", `${task.durationDays} working days`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="font-medium tabular">{v}</dd>
              </div>
            ))}
            {task.subcontractor ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Contact</dt>
                <dd className="text-right font-medium">
                  {task.subcontractor.contactName}
                  <div className="text-xs font-normal text-ink-subtle">
                    {task.subcontractor.phone ?? task.subcontractor.email}
                  </div>
                </dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <Card title="Record progress" className="lg:col-span-2">
          {archived ? (
            <EmptyState title="Project is archived" />
          ) : (
            <ActionForm
              action={recordProgressAction.bind(null, task.id)}
              submitLabel="Save update"
              pendingLabel="Saving…"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Status" htmlFor="status">
                  <select id="status" name="status" defaultValue={task.status} className="input">
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Percent complete"
                  htmlFor="percentComplete"
                  hint="Marking a task complete sets it to 100%."
                >
                  <input
                    id="percentComplete"
                    name="percentComplete"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={task.percentComplete}
                    className="input"
                  />
                </Field>
              </div>
              <Field label="What changed on site?" htmlFor="note">
                <textarea id="note" name="note" rows={3} required className="textarea" />
              </Field>
            </ActionForm>
          )}
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title="Depends on" description="Finish-to-start: this task can't start until these are complete.">
          {task.dependencies.length === 0 ? (
            <EmptyState title="No dependencies">This task can start without waiting on anything.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {task.dependencies.map((d) => (
                <li key={d.dependsOnId} className="flex items-center justify-between gap-4 py-2 first:pt-0">
                  <span>
                    <Link
                      href={`/projects/${projectId}/tasks/${d.dependsOn.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {d.dependsOn.name}
                    </Link>{" "}
                    <span className="text-xs text-ink-subtle tabular">({d.dependsOn.percentComplete}%)</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <TaskStatusBadge status={d.dependsOn.status} />
                    {!archived ? (
                      <ConfirmButton
                        action={removeDependencyAction.bind(null, task.id, d.dependsOnId)}
                        label="Remove"
                        title="Remove this dependency?"
                        description={`"${task.name}" will no longer wait for "${d.dependsOn.name}".`}
                        confirmLabel="Remove dependency"
                      />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!archived && candidates.length > 0 ? (
            <div className="mt-6 border-t border-line pt-6">
              <ActionForm
                action={addDependencyAction.bind(null, task.id)}
                submitLabel="Add dependency"
                pendingLabel="Adding…"
                className="flex flex-wrap items-end gap-4"
              >
                <div className="min-w-56 flex-1">
                  <Field label="Must finish first" htmlFor="dependsOnId">
                    <select id="dependsOnId" name="dependsOnId" defaultValue="" className="input">
                      <option value="" disabled>
                        Choose a task
                      </option>
                      {candidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </ActionForm>
            </div>
          ) : null}
        </Card>

        <Card title="Tasks waiting on this one">
          {task.dependents.length === 0 ? (
            <EmptyState title="No downstream tasks" />
          ) : (
            <ul className="divide-y divide-line">
              {task.dependents.map((d) => (
                <li key={d.task.id} className="flex items-center justify-between gap-4 py-2 first:pt-0">
                  <Link
                    href={`/projects/${projectId}/tasks/${d.task.id}`}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {d.task.name}
                  </Link>
                  <span className="text-xs text-ink-subtle">Starts {formatDate(d.task.plannedStart)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Progress history">
          {task.updates.length === 0 ? (
            <EmptyState title="No updates yet" />
          ) : (
            <ol className="space-y-4" data-testid="progress-history">
              {task.updates.map((u) => (
                <li key={u.id} className="border-l-2 border-line pl-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                    <TaskStatusBadge status={u.status} />
                    <span className="tabular">{u.percentComplete}%</span>
                    <span>· {u.author?.name ?? "Unknown"}</span>
                    <span>· {u.createdAt.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>
                    {u.source !== "manual" ? <Badge tone="info">{u.source}</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-ink">{u.note}</p>
                </li>
              ))}
            </ol>
          )}
          {task.issues.length > 0 ? (
            <div className="mt-6 border-t border-line pt-4">
              <h3 className="mb-2 text-sm font-medium">Linked issues</h3>
              <ul className="space-y-2">
                {task.issues.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <SeverityBadge severity={i.severity} /> {i.title}{" "}
                    {i.status === "RESOLVED" ? <Badge tone="success">Resolved</Badge> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        {!archived ? (
          <Card title="Edit task">
            <ActionForm action={updateTaskAction.bind(null, task.id)} submitLabel="Save task" resetOnSuccess={false}>
              <TaskFields idPrefix="edit-task" subcontractors={directory} defaults={task} />
            </ActionForm>
          </Card>
        ) : null}
      </div>
    </>
  );
}
