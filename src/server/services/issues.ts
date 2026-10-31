import { prisma } from "@/lib/db";
import type { IssueInput } from "@/lib/validation";
import type { Ctx, Tx } from "./context";
import { logActivity } from "./activity";
import { conflict, invalid, notFound } from "./errors";
import { findActiveProjectOrThrow } from "./projects";

/** Optional task links must point at a task in the same project and organization. */
export async function assertTaskInProject(tx: Tx, ctx: Ctx, projectId: string, taskId?: string) {
  if (!taskId) return null;
  const task = await tx.task.findFirst({ where: { id: taskId, projectId, organizationId: ctx.orgId } });
  if (!task) throw invalid("Choose a task from this project", { taskId: ["Unknown task"] });
  return task.id;
}

export async function createIssue(ctx: Ctx, projectId: string, input: IssueInput) {
  return prisma.$transaction(async (tx) => {
    const project = await findActiveProjectOrThrow(tx, ctx, projectId);
    const taskId = await assertTaskInProject(tx, ctx, project.id, input.taskId);
    const issue = await tx.issue.create({
      data: {
        organizationId: ctx.orgId,
        projectId: project.id,
        taskId,
        title: input.title,
        details: input.details ?? null,
        severity: input.severity,
        isBlocker: input.isBlocker,
        createdById: ctx.userId,
      },
    });
    await logActivity(tx, ctx, {
      projectId: project.id,
      action: "issue.opened",
      entityType: "issue",
      entityId: issue.id,
      summary: `Opened ${input.isBlocker ? "blocking " : ""}issue: ${issue.title}`,
    });
    return issue;
  });
}

export async function resolveIssue(ctx: Ctx, issueId: string) {
  return prisma.$transaction(async (tx) => {
    const issue = await tx.issue.findFirst({ where: { id: issueId, organizationId: ctx.orgId } });
    if (!issue) throw notFound("Issue");
    if (issue.status === "RESOLVED") throw conflict("Issue is already resolved");
    await findActiveProjectOrThrow(tx, ctx, issue.projectId);
    const updated = await tx.issue.update({
      where: { id: issue.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    await logActivity(tx, ctx, {
      projectId: issue.projectId,
      action: "issue.resolved",
      entityType: "issue",
      entityId: issue.id,
      summary: `Resolved issue: ${issue.title}`,
    });
    return updated;
  });
}
