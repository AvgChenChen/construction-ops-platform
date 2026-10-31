import { prisma } from "@/lib/db";
import { parseISODate } from "@/lib/domain/calendar";
import type { FollowUpInput } from "@/lib/validation";
import type { Ctx } from "./context";
import { logActivity } from "./activity";
import { conflict, forbidden, invalid, notFound } from "./errors";
import { findActiveProjectOrThrow } from "./projects";
import { assertTaskInProject } from "./issues";

/**
 * Follow-ups are drafted by anyone on the team (or, later, proposed by the AI agent)
 * but only an organization OWNER can approve or reject them. Nothing is sent from
 * this prototype. Approval is the gate a messaging integration would sit behind.
 */
export async function createFollowUp(ctx: Ctx, projectId: string, input: FollowUpInput) {
  return prisma.$transaction(async (tx) => {
    const project = await findActiveProjectOrThrow(tx, ctx, projectId);
    const taskId = await assertTaskInProject(tx, ctx, project.id, input.taskId);
    let subcontractorId: string | null = null;
    if (input.subcontractorId) {
      const sub = await tx.subcontractor.findFirst({
        where: { id: input.subcontractorId, organizationId: ctx.orgId },
      });
      if (!sub)
        throw invalid("Choose a subcontractor from your directory", { subcontractorId: ["Unknown subcontractor"] });
      subcontractorId = sub.id;
    }
    const followUp = await tx.followUp.create({
      data: {
        organizationId: ctx.orgId,
        projectId: project.id,
        taskId,
        subcontractorId,
        message: input.message,
        dueDate: input.dueDate ? parseISODate(input.dueDate) : null,
        createdById: ctx.userId,
      },
    });
    await logActivity(tx, ctx, {
      projectId: project.id,
      action: "follow_up.drafted",
      entityType: "follow_up",
      entityId: followUp.id,
      summary: `Drafted follow-up for approval: "${truncate(input.message)}"`,
    });
    return followUp;
  });
}

export async function reviewFollowUp(ctx: Ctx, followUpId: string, decision: "APPROVED" | "REJECTED", note?: string) {
  if (ctx.role !== "OWNER") throw forbidden("Only an account owner can approve or reject follow-ups");
  return prisma.$transaction(async (tx) => {
    const followUp = await tx.followUp.findFirst({ where: { id: followUpId, organizationId: ctx.orgId } });
    if (!followUp) throw notFound("Follow-up");
    await findActiveProjectOrThrow(tx, ctx, followUp.projectId);
    // Conditional update: if two people review at once, only the first one wins.
    const { count } = await tx.followUp.updateMany({
      where: { id: followUp.id, organizationId: ctx.orgId, status: "PENDING_APPROVAL" },
      data: { status: decision, reviewedById: ctx.userId, reviewedAt: new Date(), reviewNote: note ?? null },
    });
    if (count === 0) throw conflict("This follow-up has already been reviewed");
    await logActivity(tx, ctx, {
      projectId: followUp.projectId,
      action: decision === "APPROVED" ? "follow_up.approved" : "follow_up.rejected",
      entityType: "follow_up",
      entityId: followUp.id,
      summary: `${decision === "APPROVED" ? "Approved" : "Rejected"} follow-up: "${truncate(followUp.message)}"`,
    });
  });
}

function truncate(text: string, max = 80) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
