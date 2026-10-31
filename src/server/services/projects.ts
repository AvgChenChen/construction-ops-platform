import type { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseISODate } from "@/lib/domain/calendar";
import type { ProjectInput } from "@/lib/validation";
import type { Ctx, Tx } from "./context";
import { logActivity } from "./activity";
import { conflict, forbidden, notFound } from "./errors";

/** The single place that turns (ctx, projectId) into a project row, or "not found". */
export async function findProjectOrThrow(tx: Tx, ctx: Ctx, projectId: string) {
  const project = await tx.project.findFirst({ where: { id: projectId, organizationId: ctx.orgId } });
  if (!project) throw notFound("Project");
  return project;
}

export async function findActiveProjectOrThrow(tx: Tx, ctx: Ctx, projectId: string) {
  const project = await findProjectOrThrow(tx, ctx, projectId);
  if (project.status === "ARCHIVED") throw conflict("This project is archived. Restore it before making changes.");
  return project;
}

export async function listProjects(ctx: Ctx, status: ProjectStatus = "ACTIVE", search?: string) {
  const q = search?.trim().slice(0, 100);
  return prisma.project.findMany({
    where: {
      organizationId: ctx.orgId,
      status,
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { address: { contains: q, mode: "insensitive" } }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      tasks: { select: { durationDays: true, percentComplete: true, status: true } },
      _count: { select: { issues: { where: { status: "OPEN" } }, subcontractors: true } },
    },
  });
}

export async function getProjectDetail(ctx: Ctx, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: ctx.orgId },
    include: {
      tasks: {
        orderBy: [{ plannedStart: "asc" }, { createdAt: "asc" }],
        include: {
          subcontractor: { select: { id: true, companyName: true } },
          dependencies: { select: { dependsOnId: true } },
        },
      },
      subcontractors: { include: { subcontractor: true }, orderBy: { addedAt: "asc" } },
      issues: {
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: { task: { select: { id: true, name: true } } },
      },
      followUps: {
        orderBy: { createdAt: "desc" },
        include: {
          task: { select: { id: true, name: true } },
          subcontractor: { select: { id: true, companyName: true } },
          createdBy: { select: { name: true } },
          reviewedBy: { select: { name: true } },
        },
      },
      activity: { orderBy: { createdAt: "desc" }, take: 25, include: { actor: { select: { name: true } } } },
    },
  });
  if (!project) throw notFound("Project");
  return project;
}

function toData(input: ProjectInput) {
  return {
    name: input.name,
    clientName: input.clientName ?? null,
    address: input.address,
    description: input.description ?? null,
    startDate: parseISODate(input.startDate),
    targetEndDate: input.targetEndDate ? parseISODate(input.targetEndDate) : null,
  };
}

export async function createProject(ctx: Ctx, input: ProjectInput) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({ data: { ...toData(input), organizationId: ctx.orgId } });
    await logActivity(tx, ctx, {
      projectId: project.id,
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      summary: `Created project "${project.name}"`,
    });
    return project;
  });
}

export async function updateProject(ctx: Ctx, projectId: string, input: ProjectInput) {
  return prisma.$transaction(async (tx) => {
    await findProjectOrThrow(tx, ctx, projectId);
    const project = await tx.project.update({ where: { id: projectId }, data: toData(input) });
    await logActivity(tx, ctx, {
      projectId,
      action: "project.updated",
      entityType: "project",
      entityId: projectId,
      summary: `Updated project details for "${project.name}"`,
    });
    return project;
  });
}

export async function setProjectArchived(ctx: Ctx, projectId: string, archived: boolean) {
  if (ctx.role !== "OWNER") throw forbidden("Only an account owner can archive or restore projects");
  return prisma.$transaction(async (tx) => {
    const existing = await findProjectOrThrow(tx, ctx, projectId);
    const target: ProjectStatus = archived ? "ARCHIVED" : "ACTIVE";
    if (existing.status === target) throw conflict(`Project is already ${archived ? "archived" : "active"}`);
    const project = await tx.project.update({
      where: { id: projectId },
      data: { status: target, archivedAt: archived ? new Date() : null },
    });
    await logActivity(tx, ctx, {
      projectId,
      action: archived ? "project.archived" : "project.restored",
      entityType: "project",
      entityId: projectId,
      summary: `${archived ? "Archived" : "Restored"} project "${project.name}"`,
    });
    return project;
  });
}
