/**
 * QA coverage for the core coordination workflow: delay -> downstream impact -> follow-up
 * proposal -> owner review -> recorded outcome.
 *
 * Tests under "current behavior (decision needed)" pin what the code does TODAY where the
 * product rule is undefined. They are evidence for a product decision, not an endorsement:
 * when the rule is decided, change the assertion.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { detectBlockers } from "@/lib/domain/blockers";
import { AppError } from "@/server/services/errors";
import { createFollowUp, reviewFollowUp } from "@/server/services/followups";
import { addSubcontractorToProject, createSubcontractor } from "@/server/services/subcontractors";
import { addDependency, createTask, recordProgress } from "@/server/services/tasks";
import { createProject } from "@/server/services/projects";
import { d, makeOrganization, makeRenovation, resetDatabase } from "./helpers";

async function expectCode(promise: Promise<unknown>, code: AppError["code"]) {
  await expect(promise).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

const activity = (entityId: string, action: string) => prisma.activityLog.count({ where: { entityId, action } });

describe("follow-up approval: state transitions and exactly-once review", () => {
  let org: Awaited<ReturnType<typeof makeOrganization>>;
  let r: Awaited<ReturnType<typeof makeRenovation>>;

  beforeEach(async () => {
    await resetDatabase();
    org = await makeOrganization("Coord GC");
    r = await makeRenovation(org.ownerCtx);
  });

  const draft = () =>
    createFollowUp(org.memberCtx, r.project.id, {
      message: "Plumbing is delayed two days; please confirm electrical can shift.",
      taskId: r.electrical.id,
      subcontractorId: r.electrician.id,
    });

  it("rejection records REJECTED, the reviewer, and no approval", async () => {
    const f = await draft();
    await reviewFollowUp(org.ownerCtx, f.id, "REJECTED");
    const stored = await prisma.followUp.findUniqueOrThrow({ where: { id: f.id } });
    expect(stored).toMatchObject({ status: "REJECTED", reviewedById: org.owner.id });
    expect(stored.reviewedAt).toBeInstanceOf(Date);
    expect(await activity(f.id, "follow_up.rejected")).toBe(1);
    expect(await activity(f.id, "follow_up.approved")).toBe(0);
    // A rejected proposal cannot be approved afterwards.
    await expectCode(reviewFollowUp(org.ownerCtx, f.id, "APPROVED"), "CONFLICT");
    expect((await prisma.followUp.findUniqueOrThrow({ where: { id: f.id } })).status).toBe("REJECTED");
  });

  it("concurrent approvals (double-click / retried request) approve exactly once", async () => {
    const f = await draft();
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => reviewFollowUp(org.ownerCtx, f.id, "APPROVED")),
    );
    const ok = results.filter((x) => x.status === "fulfilled");
    const failed = results.filter((x) => x.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(5);
    for (const fail of failed) expect(fail.reason).toMatchObject({ code: "CONFLICT" });
    expect(await activity(f.id, "follow_up.approved")).toBe(1);
  });

  it("a concurrent approve and reject cannot both win", async () => {
    const f = await draft();
    const results = await Promise.allSettled([
      reviewFollowUp(org.ownerCtx, f.id, "APPROVED"),
      reviewFollowUp(org.ownerCtx, f.id, "REJECTED"),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const stored = await prisma.followUp.findUniqueOrThrow({ where: { id: f.id } });
    const reviewActions = await prisma.activityLog.findMany({
      where: { entityId: f.id, action: { in: ["follow_up.approved", "follow_up.rejected"] } },
    });
    expect(reviewActions).toHaveLength(1);
    expect(reviewActions[0].action).toBe(stored.status === "APPROVED" ? "follow_up.approved" : "follow_up.rejected");
  });

  it("a member's forced approval leaves the proposal pending and writes no approval", async () => {
    const f = await draft();
    await expectCode(reviewFollowUp(org.memberCtx, f.id, "APPROVED"), "FORBIDDEN");
    expect((await prisma.followUp.findUniqueOrThrow({ where: { id: f.id } })).status).toBe("PENDING_APPROVAL");
    expect(await activity(f.id, "follow_up.approved")).toBe(0);
  });
});

describe("delay -> downstream impact (service + domain)", () => {
  beforeEach(resetDatabase);

  it("a delay reported on plumbing flags the dependent electrical task and names plumbing as the cause", async () => {
    const org = await makeOrganization("Impact GC");
    const project = await createProject(org.ownerCtx, {
      name: "Impact",
      address: "1 Impact Rd",
      startDate: "2026-11-09",
    });
    const plumbing = await createTask(org.ownerCtx, project.id, {
      name: "Plumbing rough-in",
      trade: "PLUMBING",
      plannedStart: "2026-11-09", // Mon
      durationDays: 2, // ends Tue Nov 10
      dependsOn: [],
    });
    const electrical = await createTask(org.ownerCtx, project.id, {
      name: "Electrical rough-in",
      trade: "ELECTRICAL",
      plannedStart: "2026-11-11", // Wed
      durationDays: 3,
      dependsOn: [],
    });
    await addDependency(org.memberCtx, electrical.id, plumbing.id);
    await recordProgress(org.memberCtx, plumbing.id, {
      status: "BLOCKED",
      percentComplete: 20,
      note: "Sub reports: fixtures backordered, two-day delay.",
    });

    const tasks = await prisma.task.findMany({ where: { projectId: project.id }, include: { dependencies: true } });
    const blockers = detectBlockers(
      tasks.map((t) => ({ ...t, dependsOn: t.dependencies.map((x) => x.dependsOnId) })),
      [],
      d("2026-11-10"), // Tue: electrical starts tomorrow
    );
    const byName = Object.fromEntries(blockers.map((b) => [b.taskName, b]));
    expect(byName["Plumbing rough-in"].level).toBe("blocked");
    expect(byName["Electrical rough-in"].level).toBe("at_risk");
    expect(byName["Electrical rough-in"].waitingOn.map((w) => w.id)).toEqual([plumbing.id]);
    expect(byName["Electrical rough-in"].reasons.join(" ")).toContain("Plumbing rough-in (blocked, 20%)");

    // The update persisted with its author and source, and was logged once.
    const updates = await prisma.progressUpdate.findMany({ where: { taskId: plumbing.id } });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: "BLOCKED", authorId: org.member.id, source: "manual" });
    expect(await prisma.activityLog.count({ where: { entityId: plumbing.id, action: "task.progress_recorded" } })).toBe(
      1,
    );
  });
});

describe("updates cannot attach to the wrong job", () => {
  beforeEach(resetDatabase);

  it("rejects a follow-up that links a task from a different project in the same company", async () => {
    const org = await makeOrganization("Two Jobs GC");
    const jobA = await makeRenovation(org.ownerCtx);
    const jobB = await createProject(org.ownerCtx, { name: "Job B", address: "2 B St", startDate: "2026-11-02" });
    await expectCode(
      createFollowUp(org.ownerCtx, jobB.id, { message: "Wrong job link", taskId: jobA.electrical.id }),
      "VALIDATION",
    );
    expect(await prisma.followUp.count()).toBe(0);
  });
});

describe("current behavior (decision needed) — pinned so a rule change is deliberate", () => {
  beforeEach(resetDatabase);

  it("GAP: approval does not revalidate a proposal whose task changed after drafting", async () => {
    const org = await makeOrganization("Stale GC");
    const r = await makeRenovation(org.ownerCtx);
    const f = await createFollowUp(org.memberCtx, r.project.id, {
      message: "Electrical is late; please confirm new finish date.",
      taskId: r.electrical.id,
      subcontractorId: r.electrician.id,
    });
    // The underlying situation changes: electrical is now complete.
    await recordProgress(org.ownerCtx, r.electrical.id, { status: "COMPLETE", percentComplete: 100, note: "Done" });
    // Today the stale proposal is still approved without any check.
    await reviewFollowUp(org.ownerCtx, f.id, "APPROVED");
    expect((await prisma.followUp.findUniqueOrThrow({ where: { id: f.id } })).status).toBe("APPROVED");
  });

  it("GAP: a follow-up may target a directory subcontractor who is not on the project", async () => {
    const org = await makeOrganization("Unrelated Sub GC");
    const r = await makeRenovation(org.ownerCtx);
    await addSubcontractorToProject(org.ownerCtx, r.project.id, r.electrician.id);
    const unrelated = await createSubcontractor(org.ownerCtx, {
      companyName: "Unrelated Roofing",
      trade: "ROOFING",
      contactName: "U. Related",
    });
    // The project page only offers project subcontractors, but the server accepts any directory entry.
    const f = await createFollowUp(org.ownerCtx, r.project.id, {
      message: "Sent to the wrong trade",
      taskId: r.electrical.id,
      subcontractorId: unrelated.id,
    });
    expect(f.subcontractorId).toBe(unrelated.id);
  });

  it("GAP: a successor can be scheduled to start before its prerequisite finishes, with no warning", async () => {
    const org = await makeOrganization("Overlap GC");
    const project = await createProject(org.ownerCtx, { name: "Overlap", address: "3 C St", startDate: "2026-11-02" });
    const plumbing = await createTask(org.ownerCtx, project.id, {
      name: "Plumbing",
      trade: "PLUMBING",
      plannedStart: "2026-11-02",
      durationDays: 5, // ends Fri Nov 6
      dependsOn: [],
    });
    const electrical = await createTask(org.ownerCtx, project.id, {
      name: "Electrical",
      trade: "ELECTRICAL",
      plannedStart: "2026-11-03", // starts while plumbing is still planned to run
      durationDays: 2,
      dependsOn: [plumbing.id],
    });
    expect(electrical.plannedStart < plumbing.plannedEnd).toBe(true);
  });
});

describe("database-level tenant isolation for nullable references", () => {
  let a: Awaited<ReturnType<typeof makeOrganization>>;
  let b: Awaited<ReturnType<typeof makeOrganization>>;
  beforeEach(async () => {
    await resetDatabase();
    a = await makeOrganization("Alpha FK");
    b = await makeOrganization("Bravo FK");
  });

  // schema.prisma states the database rejects rows pointing at another organization's
  // "project, task, or subcontractor". Task.subcontractorId, FollowUp.subcontractorId,
  // FollowUp.taskId and Issue.taskId are single-column foreign keys, so that guarantee
  // does not hold for them; only the service layer protects these links.
  // KNOWN DEFECT: `it.fails` passes while the defect exists and will fail (prompting removal
  // of `.fails`) once composite foreign keys are added.
  it.fails(
    "KNOWN DEFECT: rejects a direct insert of a follow-up pointing at another company's subcontractor",
    async () => {
      const aData = await makeRenovation(a.ownerCtx);
      const bData = await makeRenovation(b.ownerCtx);
      await expect(
        prisma.followUp.create({
          data: {
            organizationId: b.org.id,
            projectId: bData.project.id,
            subcontractorId: aData.electrician.id,
            taskId: aData.electrical.id,
            message: "direct cross-tenant insert",
          },
        }),
      ).rejects.toMatchObject({ code: "P2003" });
    },
  );
});
