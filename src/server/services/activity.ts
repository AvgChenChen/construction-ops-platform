import type { Ctx, Tx } from "./context";

export type ActivityInput = {
  projectId?: string | null;
  action: string;
  entityType: "project" | "subcontractor" | "task" | "dependency" | "progress" | "issue" | "follow_up";
  entityId: string;
  summary: string;
};

/** Written inside the same transaction as the change it describes, so the log can't drift. */
export async function logActivity(tx: Tx, ctx: Ctx, input: ActivityInput) {
  await tx.activityLog.create({
    data: {
      organizationId: ctx.orgId,
      actorId: ctx.userId,
      projectId: input.projectId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
    },
  });
}
