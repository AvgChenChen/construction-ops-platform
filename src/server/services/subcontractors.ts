import type { Trade } from "@prisma/client";
import { prisma } from "@/lib/db";
import { TRADE_LABELS } from "@/lib/domain/trades";
import type { SubcontractorInput } from "@/lib/validation";
import type { Ctx, Tx } from "./context";
import { logActivity } from "./activity";
import { conflict, isUniqueViolation, notFound } from "./errors";
import { findActiveProjectOrThrow } from "./projects";

export async function findSubcontractorOrThrow(tx: Tx, ctx: Ctx, subcontractorId: string) {
  const sub = await tx.subcontractor.findFirst({ where: { id: subcontractorId, organizationId: ctx.orgId } });
  if (!sub) throw notFound("Subcontractor");
  return sub;
}

export async function listSubcontractors(ctx: Ctx, trade?: Trade) {
  return prisma.subcontractor.findMany({
    where: { organizationId: ctx.orgId, ...(trade ? { trade } : {}) },
    orderBy: [{ trade: "asc" }, { companyName: "asc" }],
    include: { _count: { select: { projects: true, tasks: true } } },
  });
}

export async function createSubcontractor(ctx: Ctx, input: SubcontractorInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const sub = await tx.subcontractor.create({
        data: {
          organizationId: ctx.orgId,
          companyName: input.companyName,
          trade: input.trade,
          contactName: input.contactName,
          email: input.email ?? null,
          phone: input.phone ?? null,
        },
      });
      await logActivity(tx, ctx, {
        action: "subcontractor.created",
        entityType: "subcontractor",
        entityId: sub.id,
        summary: `Added ${TRADE_LABELS[sub.trade].toLowerCase()} subcontractor ${sub.companyName}`,
      });
      return sub;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("A subcontractor with this company name already exists");
    throw error;
  }
}

export async function addSubcontractorToProject(ctx: Ctx, projectId: string, subcontractorId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const project = await findActiveProjectOrThrow(tx, ctx, projectId);
      const sub = await findSubcontractorOrThrow(tx, ctx, subcontractorId);
      const link = await tx.projectSubcontractor.create({
        data: { organizationId: ctx.orgId, projectId: project.id, subcontractorId: sub.id },
      });
      await logActivity(tx, ctx, {
        projectId,
        action: "project.subcontractor_added",
        entityType: "subcontractor",
        entityId: sub.id,
        summary: `Added ${sub.companyName} to the project`,
      });
      return link;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("This subcontractor is already on the project");
    throw error;
  }
}

export async function removeSubcontractorFromProject(ctx: Ctx, projectId: string, subcontractorId: string) {
  return prisma.$transaction(async (tx) => {
    await findActiveProjectOrThrow(tx, ctx, projectId);
    const sub = await findSubcontractorOrThrow(tx, ctx, subcontractorId);
    const { count } = await tx.projectSubcontractor.deleteMany({
      where: { organizationId: ctx.orgId, projectId, subcontractorId },
    });
    if (count === 0) throw notFound("Project subcontractor");
    await logActivity(tx, ctx, {
      projectId,
      action: "project.subcontractor_removed",
      entityType: "subcontractor",
      entityId: sub.id,
      summary: `Removed ${sub.companyName} from the project`,
    });
  });
}
