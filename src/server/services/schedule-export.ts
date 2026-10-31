import { prisma } from "@/lib/db";
import { toISODate } from "@/lib/domain/calendar";
import { toContractEnum } from "@/lib/domain/trades";
import type { Ctx } from "./context";
import { notFound } from "./errors";

/**
 * Exports a project in the shared "ScheduleContract v1" shape documented in
 * docs/INTEGRATION.md. construction-dependency-engine's POST /v1/schedules/analyze
 * accepts this JSON unchanged.
 */
export async function exportSchedule(ctx: Ctx, projectId: string, asOf: Date) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: ctx.orgId },
    include: {
      tasks: {
        orderBy: { plannedStart: "asc" },
        include: { dependencies: { select: { dependsOnId: true } } },
      },
    },
  });
  if (!project) throw notFound("Project");
  return {
    contract_version: "1.0",
    project_id: project.id,
    project_name: project.name,
    start_date: toISODate(project.startDate),
    as_of: toISODate(asOf),
    tasks: project.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      trade: toContractEnum(t.trade),
      duration_days: t.durationDays,
      status: toContractEnum(t.status),
      percent_complete: t.percentComplete,
      planned_start: toISODate(t.plannedStart),
      depends_on: t.dependencies.map((d) => d.dependsOnId),
    })),
  };
}
