import { prisma } from "@/lib/db";
import { parseISODate, plannedEndFor } from "@/lib/domain/calendar";
import { wouldCreateCycle } from "@/lib/domain/graph";
import { STATUS_LABELS } from "@/lib/domain/trades";
import type { ProgressInput, TaskInput } from "@/lib/validation";
import type { Ctx, Tx } from "./context";
import { logActivity } from "./activity";
import { conflict, invalid, isUniqueViolation, notFound } from "./errors";
import { findActiveProjectOrThrow } from "./projects";
import { findSubcontractorOrThrow } from "./subcontractors";

export async function findTaskOrThrow(tx: Tx, ctx: Ctx, taskId: string) {
  const task = await tx.task.findFirst({
    where: { id: taskId, organizationId: ctx.orgId },
    include: { project: { select: { id: true, name: true, status: true } } },
  });
  if (!task) throw notFound("Task");
  return task;
}

async function assertSubcontractor(tx: Tx, ctx: Ctx, subcontractorId?: string) {
  if (!subcontractorId) return null;
  try {
    return (await findSubcontractorOrThrow(tx, ctx, subcontractorId)).id;
  } catch {
    throw invalid("Choose a subcontractor from your directory", { subcontractorId: ["Unknown subcontractor"] });
  }
}

export async function getTaskDetail(ctx: Ctx, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: ctx.orgId },
    include: {
      project: { select: { id: true, name: true, status: true } },
      subcontractor: true,
      dependencies: {
        include: { dependsOn: { select: { id: true, name: true, status: true, percentComplete: true } } },
      },
      dependents: { include: { task: { select: { id: true, name: true, status: true, plannedStart: true } } } },
      updates: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      issues: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!task) throw notFound("Task");
  const siblings = await prisma.task.findMany({
    where: { projectId: task.projectId, organizationId: ctx.orgId, NOT: { id: task.id } },
    select: { id: true, name: true },
    orderBy: { plannedStart: "asc" },
  });
  return { task, siblings };
}

export async function createTask(ctx: Ctx, projectId: string, input: TaskInput) {
  return prisma.$transaction(async (tx) => {
    const project = await findActiveProjectOrThrow(tx, ctx, projectId);
    const subcontractorId = await assertSubcontractor(tx, ctx, input.subcontractorId);

    const dependsOn = [...new Set(input.dependsOn)];
    if (dependsOn.length > 0) {
      const found = await tx.task.count({
        where: { id: { in: dependsOn }, projectId: project.id, organizationId: ctx.orgId },
      });
      if (found !== dependsOn.length) {
        throw invalid("Dependencies must be tasks on the same project", { dependsOn: ["Unknown task"] });
      }
    }

    const plannedStart = parseISODate(input.plannedStart);
    const task = await tx.task.create({
      data: {
        organizationId: ctx.orgId,
        projectId: project.id,
        name: input.name,
        trade: input.trade,
        location: input.location ?? null,
        subcontractorId,
        plannedStart,
        durationDays: input.durationDays,
        plannedEnd: plannedEndFor(plannedStart, input.durationDays),
      },
    });
    // A brand-new task has no dependents, so these edges cannot form a cycle.
    await tx.taskDependency.createMany({
      data: dependsOn.map((id) => ({ organizationId: ctx.orgId, taskId: task.id, dependsOnId: id })),
    });
    await logActivity(tx, ctx, {
      projectId: project.id,
      action: "task.created",
      entityType: "task",
      entityId: task.id,
      summary: `Added task "${task.name}"`,
    });
    return task;
  });
}

export async function updateTask(ctx: Ctx, taskId: string, input: Omit<TaskInput, "dependsOn">) {
  return prisma.$transaction(async (tx) => {
    const existing = await findTaskOrThrow(tx, ctx, taskId);
    await findActiveProjectOrThrow(tx, ctx, existing.projectId);
    const subcontractorId = await assertSubcontractor(tx, ctx, input.subcontractorId);
    const plannedStart = parseISODate(input.plannedStart);
    const task = await tx.task.update({
      where: { id: taskId },
      data: {
        name: input.name,
        trade: input.trade,
        location: input.location ?? null,
        subcontractorId,
        plannedStart,
        durationDays: input.durationDays,
        plannedEnd: plannedEndFor(plannedStart, input.durationDays),
      },
    });
    await logActivity(tx, ctx, {
      projectId: existing.projectId,
      action: "task.updated",
      entityType: "task",
      entityId: task.id,
      summary: `Updated task "${task.name}"`,
    });
    return task;
  });
}

export async function addDependency(ctx: Ctx, taskId: string, dependsOnId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const task = await findTaskOrThrow(tx, ctx, taskId);
      await findActiveProjectOrThrow(tx, ctx, task.projectId);
      const predecessor = await findTaskOrThrow(tx, ctx, dependsOnId);
      if (predecessor.projectId !== task.projectId) {
        throw invalid("A task can only depend on tasks in the same project");
      }
      const edges = await tx.taskDependency.findMany({
        where: { organizationId: ctx.orgId, task: { projectId: task.projectId } },
        select: { taskId: true, dependsOnId: true },
      });
      if (wouldCreateCycle(edges, task.id, predecessor.id)) {
        throw invalid(
          `"${task.name}" can't wait on "${predecessor.name}" because "${predecessor.name}" already waits on it (directly or indirectly). That would be a circular dependency.`,
        );
      }
      await tx.taskDependency.create({
        data: { organizationId: ctx.orgId, taskId: task.id, dependsOnId: predecessor.id },
      });
      await logActivity(tx, ctx, {
        projectId: task.projectId,
        action: "dependency.added",
        entityType: "dependency",
        entityId: task.id,
        summary: `"${task.name}" now waits on "${predecessor.name}"`,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("That dependency already exists");
    throw error;
  }
}

export async function removeDependency(ctx: Ctx, taskId: string, dependsOnId: string) {
  return prisma.$transaction(async (tx) => {
    const task = await findTaskOrThrow(tx, ctx, taskId);
    await findActiveProjectOrThrow(tx, ctx, task.projectId);
    const { count } = await tx.taskDependency.deleteMany({
      where: { organizationId: ctx.orgId, taskId, dependsOnId },
    });
    if (count === 0) throw notFound("Dependency");
    await logActivity(tx, ctx, {
      projectId: task.projectId,
      action: "dependency.removed",
      entityType: "dependency",
      entityId: task.id,
      summary: `Removed a dependency from "${task.name}"`,
    });
  });
}

export async function recordProgress(ctx: Ctx, taskId: string, input: ProgressInput, source = "manual") {
  return prisma.$transaction(async (tx) => {
    const task = await findTaskOrThrow(tx, ctx, taskId);
    await findActiveProjectOrThrow(tx, ctx, task.projectId);
    const update = await tx.progressUpdate.create({
      data: {
        organizationId: ctx.orgId,
        taskId: task.id,
        authorId: ctx.userId,
        status: input.status,
        percentComplete: input.percentComplete,
        note: input.note,
        source,
      },
    });
    await tx.task.update({
      where: { id: task.id },
      data: {
        status: input.status,
        percentComplete: input.percentComplete,
        completedAt: input.status === "COMPLETE" ? (task.completedAt ?? new Date()) : null,
      },
    });
    await logActivity(tx, ctx, {
      projectId: task.projectId,
      action: "task.progress_recorded",
      entityType: "progress",
      entityId: task.id,
      summary: `"${task.name}": ${STATUS_LABELS[input.status].toLowerCase()}, ${input.percentComplete}%`,
    });
    return update;
  });
}
