import { prisma } from "@/lib/db";
import { detectBlockers, projectProgress, type Blocker } from "@/lib/domain/blockers";
import type { Ctx } from "./context";

export async function getDashboard(ctx: Ctx, today: Date) {
  const [projects, pendingFollowUps, recentActivity, openIssueCount] = await Promise.all([
    prisma.project.findMany({
      where: { organizationId: ctx.orgId, status: "ACTIVE" },
      orderBy: { startDate: "asc" },
      include: {
        tasks: { include: { dependencies: { select: { dependsOnId: true } } } },
        issues: { where: { status: "OPEN" }, select: { taskId: true, title: true, isBlocker: true, status: true } },
      },
    }),
    prisma.followUp.findMany({
      where: { organizationId: ctx.orgId, status: "PENDING_APPROVAL", project: { status: "ACTIVE" } },
      orderBy: { createdAt: "asc" },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, name: true } },
        subcontractor: { select: { companyName: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.activityLog.findMany({
      where: { organizationId: ctx.orgId },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { actor: { select: { name: true } }, project: { select: { id: true, name: true } } },
    }),
    prisma.issue.count({ where: { organizationId: ctx.orgId, status: "OPEN", project: { status: "ACTIVE" } } }),
  ]);

  const projectSummaries = projects.map((p) => {
    const blockers = detectBlockers(
      p.tasks.map((t) => ({ ...t, dependsOn: t.dependencies.map((d) => d.dependsOnId) })),
      p.issues,
      today,
    );
    return {
      id: p.id,
      name: p.name,
      address: p.address,
      progress: projectProgress(p.tasks),
      taskCount: p.tasks.length,
      completeCount: p.tasks.filter((t) => t.status === "COMPLETE").length,
      openIssues: p.issues.length,
      blockers,
    };
  });

  const blockers: (Blocker & { projectId: string; projectName: string })[] = projectSummaries.flatMap((p) =>
    p.blockers.map((b) => ({ ...b, projectId: p.id, projectName: p.name })),
  );

  return {
    projects: projectSummaries,
    blockers,
    pendingFollowUps,
    recentActivity,
    stats: {
      activeProjects: projects.length,
      blocked: blockers.filter((b) => b.level === "blocked").length,
      atRisk: blockers.filter((b) => b.level === "at_risk").length,
      openIssues: openIssueCount,
      pendingApprovals: pendingFollowUps.length,
    },
  };
}
