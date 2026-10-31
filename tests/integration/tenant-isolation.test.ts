import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { AppError } from "@/server/services/errors";
import { getProjectDetail, listProjects, setProjectArchived, updateProject } from "@/server/services/projects";
import { addDependency, createTask, getTaskDetail, recordProgress, updateTask } from "@/server/services/tasks";
import { addSubcontractorToProject, listSubcontractors } from "@/server/services/subcontractors";
import { createIssue, resolveIssue } from "@/server/services/issues";
import { createFollowUp, reviewFollowUp } from "@/server/services/followups";
import { getDashboard } from "@/server/services/dashboard";
import { exportSchedule } from "@/server/services/schedule-export";
import { d, makeOrganization, makeRenovation, resetDatabase } from "./helpers";

async function expectCode(promise: Promise<unknown>, code: AppError["code"]) {
  await expect(promise).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

describe("tenant isolation: company B cannot touch company A's data", () => {
  let a: Awaited<ReturnType<typeof makeOrganization>>;
  let b: Awaited<ReturnType<typeof makeOrganization>>;
  let aData: Awaited<ReturnType<typeof makeRenovation>>;

  beforeEach(async () => {
    await resetDatabase();
    a = await makeOrganization("Alpha Builders");
    b = await makeOrganization("Bravo Construction");
    aData = await makeRenovation(a.ownerCtx);
  });

  it("does not list or read another company's projects", async () => {
    expect(await listProjects(b.ownerCtx)).toHaveLength(0);
    expect(await listProjects(a.ownerCtx)).toHaveLength(1);
    await expectCode(getProjectDetail(b.ownerCtx, aData.project.id), "NOT_FOUND");
  });

  it("reports other companies' records as NOT_FOUND, never FORBIDDEN, so ids don't leak", async () => {
    await expectCode(getTaskDetail(b.ownerCtx, aData.drywall.id), "NOT_FOUND");
    await expectCode(exportSchedule(b.ownerCtx, aData.project.id, d("2026-11-02")), "NOT_FOUND");
  });

  it("cannot edit, archive, or add tasks to another company's project", async () => {
    await expectCode(
      updateProject(b.ownerCtx, aData.project.id, { name: "Hijacked", address: "x x x", startDate: "2026-11-02" }),
      "NOT_FOUND",
    );
    await expectCode(setProjectArchived(b.ownerCtx, aData.project.id, true), "NOT_FOUND");
    await expectCode(
      createTask(b.ownerCtx, aData.project.id, {
        name: "Rogue task",
        trade: "OTHER",
        plannedStart: "2026-11-02",
        durationDays: 1,
        dependsOn: [],
      }),
      "NOT_FOUND",
    );
    const project = await prisma.project.findUniqueOrThrow({ where: { id: aData.project.id } });
    expect(project.name).toBe("Test Renovation");
    expect(project.status).toBe("ACTIVE");
  });

  it("cannot record progress on, or edit, another company's task", async () => {
    await expectCode(
      recordProgress(b.ownerCtx, aData.electrical.id, { status: "COMPLETE", percentComplete: 100, note: "fake" }),
      "NOT_FOUND",
    );
    await expectCode(
      updateTask(b.ownerCtx, aData.electrical.id, {
        name: "x x",
        trade: "OTHER",
        plannedStart: "2026-11-02",
        durationDays: 1,
      }),
      "NOT_FOUND",
    );
    const task = await prisma.task.findUniqueOrThrow({ where: { id: aData.electrical.id } });
    expect(task.status).toBe("NOT_STARTED");
    expect(await prisma.progressUpdate.count()).toBe(0);
  });

  it("cannot link its own records to another company's records", async () => {
    const bData = await makeRenovation(b.ownerCtx);
    // B's project, A's subcontractor
    await expectCode(addSubcontractorToProject(b.ownerCtx, bData.project.id, aData.electrician.id), "NOT_FOUND");
    // B's task assigned to A's subcontractor
    await expectCode(
      createTask(b.ownerCtx, bData.project.id, {
        name: "Sneaky",
        trade: "ELECTRICAL",
        plannedStart: "2026-11-02",
        durationDays: 1,
        subcontractorId: aData.electrician.id,
        dependsOn: [],
      }),
      "VALIDATION",
    );
    // B's task depending on A's task
    await expectCode(
      createTask(b.ownerCtx, bData.project.id, {
        name: "Sneaky",
        trade: "OTHER",
        plannedStart: "2026-11-02",
        durationDays: 1,
        dependsOn: [aData.electrical.id],
      }),
      "VALIDATION",
    );
    await expectCode(addDependency(b.ownerCtx, bData.drywall.id, aData.electrical.id), "NOT_FOUND");
    // Issue and follow-up on B's project pointing at A's task / subcontractor
    await expectCode(
      createIssue(b.ownerCtx, bData.project.id, {
        title: "Cross link",
        severity: "LOW",
        isBlocker: false,
        taskId: aData.electrical.id,
      }),
      "VALIDATION",
    );
    await expectCode(
      createFollowUp(b.ownerCtx, bData.project.id, {
        message: "Cross link test",
        subcontractorId: aData.electrician.id,
      }),
      "VALIDATION",
    );
  });

  it("cannot resolve another company's issue or approve its follow-up", async () => {
    const issue = await createIssue(a.ownerCtx, aData.project.id, {
      title: "Real issue",
      severity: "HIGH",
      isBlocker: true,
      taskId: aData.electrical.id,
    });
    const followUp = await createFollowUp(a.memberCtx, aData.project.id, { message: "Please confirm finish date" });
    await expectCode(resolveIssue(b.ownerCtx, issue.id), "NOT_FOUND");
    await expectCode(reviewFollowUp(b.ownerCtx, followUp.id, "APPROVED"), "NOT_FOUND");
    expect((await prisma.issue.findUniqueOrThrow({ where: { id: issue.id } })).status).toBe("OPEN");
    expect((await prisma.followUp.findUniqueOrThrow({ where: { id: followUp.id } })).status).toBe("PENDING_APPROVAL");
  });

  it("keeps dashboards and directories separate", async () => {
    await createFollowUp(a.memberCtx, aData.project.id, { message: "Alpha-only follow-up" });
    const dash = await getDashboard(b.ownerCtx, d("2026-11-05"));
    expect(dash.projects).toHaveLength(0);
    expect(dash.pendingFollowUps).toHaveLength(0);
    expect(dash.recentActivity).toHaveLength(0);
    expect(await listSubcontractors(b.ownerCtx)).toHaveLength(0);
  });

  it("is also enforced by the database: composite foreign keys reject cross-tenant rows", async () => {
    // Bypass the service layer entirely and try to attach a task in org B to org A's project.
    await expect(
      prisma.task.create({
        data: {
          organizationId: b.org.id,
          projectId: aData.project.id,
          name: "Inserted directly",
          trade: "OTHER",
          plannedStart: d("2026-11-02"),
          plannedEnd: d("2026-11-02"),
          durationDays: 1,
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" }); // foreign key violation
  });
});
