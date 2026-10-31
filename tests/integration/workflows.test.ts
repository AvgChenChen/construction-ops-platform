import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { AppError } from "@/server/services/errors";
import { authenticate, createSession, invalidateSession, signUp, validateSessionToken } from "@/server/services/auth";
import { hashSessionToken } from "@/server/auth/tokens";
import { createProject, listProjects, setProjectArchived } from "@/server/services/projects";
import { addDependency, createTask, recordProgress, removeDependency } from "@/server/services/tasks";
import { addSubcontractorToProject, createSubcontractor } from "@/server/services/subcontractors";
import { createIssue, resolveIssue } from "@/server/services/issues";
import { createFollowUp, reviewFollowUp } from "@/server/services/followups";
import { getDashboard } from "@/server/services/dashboard";
import { exportSchedule } from "@/server/services/schedule-export";
import { d, makeOrganization, makeRenovation, resetDatabase } from "./helpers";

async function expectCode(promise: Promise<unknown>, code: AppError["code"]) {
  await expect(promise).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

describe("authentication and sessions", () => {
  beforeEach(resetDatabase);

  it("signs up an owner in a new organization and authenticates them", async () => {
    const user = await signUp({
      organizationName: "New GC",
      name: "Pat",
      email: "pat@newgc.example",
      password: "a-long-password",
    });
    expect(user.role).toBe("OWNER");
    expect(user.passwordHash).not.toContain("a-long-password");
    expect((await authenticate("pat@newgc.example", "a-long-password"))?.id).toBe(user.id);
    expect(await authenticate("pat@newgc.example", "wrong-password")).toBeNull();
    expect(await authenticate("nobody@newgc.example", "a-long-password")).toBeNull();
  });

  it("rejects a duplicate email", async () => {
    await signUp({ organizationName: "One", name: "A", email: "dup@x.example", password: "a-long-password" });
    await expectCode(
      signUp({ organizationName: "Two", name: "B", email: "dup@x.example", password: "a-long-password" }),
      "CONFLICT",
    );
  });

  it("throttles repeated failed logins for the same email", async () => {
    await signUp({ organizationName: "T", name: "T", email: "throttle@x.example", password: "a-long-password" });
    for (let i = 0; i < 5; i++) expect(await authenticate("throttle@x.example", "nope")).toBeNull();
    await expectCode(authenticate("throttle@x.example", "a-long-password"), "RATE_LIMITED");
  });

  it("stores only a hash of the session token, and expires and revokes sessions", async () => {
    const { owner } = await makeOrganization("Session Co");
    const { token } = await createSession(owner.id);
    const row = await prisma.session.findFirstOrThrow({ where: { userId: owner.id } });
    expect(row.tokenHash).toBe(hashSessionToken(token));
    expect(row.tokenHash).not.toBe(token);
    expect((await validateSessionToken(token))?.user.id).toBe(owner.id);

    await prisma.session.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await validateSessionToken(token)).toBeNull();
    expect(await prisma.session.count()).toBe(0); // expired session is cleaned up

    const second = await createSession(owner.id);
    await invalidateSession(second.token);
    expect(await validateSessionToken(second.token)).toBeNull();
    expect(await validateSessionToken("not-a-real-token")).toBeNull();
  });
});

describe("construction workflows", () => {
  let org: Awaited<ReturnType<typeof makeOrganization>>;
  beforeEach(async () => {
    await resetDatabase();
    org = await makeOrganization("Workflow GC");
  });

  it("flags drywall as at risk while electrical is incomplete, then clears it", async () => {
    const r = await makeRenovation(org.ownerCtx); // drywall planned for Fri 2026-11-06
    await recordProgress(org.memberCtx, r.plumbing.id, {
      status: "COMPLETE",
      percentComplete: 100,
      note: "Rough-in done",
    });
    await recordProgress(org.memberCtx, r.electrical.id, {
      status: "IN_PROGRESS",
      percentComplete: 60,
      note: "Ensuite still open",
    });

    const dash = await getDashboard(org.ownerCtx, d("2026-11-04"));
    const drywall = dash.blockers.find((b) => b.taskId === r.drywall.id);
    expect(drywall?.level).toBe("at_risk");
    expect(drywall?.waitingOn.map((w) => w.name)).toEqual(["Electrical rough-in"]);

    await recordProgress(org.memberCtx, r.electrical.id, { status: "COMPLETE", percentComplete: 100, note: "Done" });
    const after = await getDashboard(org.ownerCtx, d("2026-11-04"));
    expect(after.blockers.find((b) => b.taskId === r.drywall.id)).toBeUndefined();
  });

  it("records progress history and normalizes COMPLETE to 100%", async () => {
    const r = await makeRenovation(org.ownerCtx);
    await recordProgress(org.memberCtx, r.electrical.id, {
      status: "COMPLETE",
      percentComplete: 100,
      note: "Finished",
    });
    const task = await prisma.task.findUniqueOrThrow({ where: { id: r.electrical.id } });
    expect(task.percentComplete).toBe(100);
    expect(task.completedAt).not.toBeNull();
    const updates = await prisma.progressUpdate.findMany({ where: { taskId: task.id } });
    expect(updates).toHaveLength(1);
    expect(updates[0].authorId).toBe(org.member.id);

    await recordProgress(org.memberCtx, r.electrical.id, {
      status: "IN_PROGRESS",
      percentComplete: 90,
      note: "Inspector found a missing box",
    });
    expect((await prisma.task.findUniqueOrThrow({ where: { id: r.electrical.id } })).completedAt).toBeNull();
  });

  it("refuses circular and cross-project dependencies", async () => {
    const r = await makeRenovation(org.ownerCtx);
    await expectCode(addDependency(org.ownerCtx, r.electrical.id, r.drywall.id), "VALIDATION");
    await expectCode(addDependency(org.ownerCtx, r.drywall.id, r.drywall.id), "VALIDATION");
    await expectCode(addDependency(org.ownerCtx, r.drywall.id, r.electrical.id), "CONFLICT"); // already exists

    const other = await createProject(org.ownerCtx, {
      name: "Other job",
      address: "2 Test Street",
      startDate: "2026-11-02",
    });
    const otherTask = await createTask(org.ownerCtx, other.id, {
      name: "Unrelated",
      trade: "OTHER",
      plannedStart: "2026-11-02",
      durationDays: 1,
      dependsOn: [],
    });
    await expectCode(addDependency(org.ownerCtx, r.drywall.id, otherTask.id), "VALIDATION");

    await removeDependency(org.ownerCtx, r.drywall.id, r.electrical.id);
    await addDependency(org.ownerCtx, r.electrical.id, r.plumbing.id);
    expect(await prisma.taskDependency.count({ where: { taskId: r.electrical.id } })).toBe(1);
  });

  it("computes planned end dates in working days", async () => {
    const project = await createProject(org.ownerCtx, {
      name: "Calendar check",
      address: "3 Test Street",
      startDate: "2026-11-06",
    });
    const task = await createTask(org.ownerCtx, project.id, {
      name: "Framing",
      trade: "FRAMING",
      plannedStart: "2026-11-06",
      durationDays: 3,
      dependsOn: [],
    });
    expect(task.plannedEnd.toISOString().slice(0, 10)).toBe("2026-11-10"); // Fri + Mon + Tue
  });

  it("makes archived projects read-only until restored", async () => {
    const r = await makeRenovation(org.ownerCtx);
    await setProjectArchived(org.ownerCtx, r.project.id, true);
    await expectCode(
      createTask(org.ownerCtx, r.project.id, {
        name: "Late add",
        trade: "OTHER",
        plannedStart: "2026-11-02",
        durationDays: 1,
        dependsOn: [],
      }),
      "CONFLICT",
    );
    await expectCode(
      recordProgress(org.ownerCtx, r.electrical.id, { status: "IN_PROGRESS", percentComplete: 10, note: "x" }),
      "CONFLICT",
    );
    await expectCode(setProjectArchived(org.ownerCtx, r.project.id, true), "CONFLICT");
    expect((await getDashboard(org.ownerCtx, d("2026-11-04"))).projects).toHaveLength(0);

    await setProjectArchived(org.ownerCtx, r.project.id, false);
    await createTask(org.ownerCtx, r.project.id, {
      name: "Late add",
      trade: "OTHER",
      plannedStart: "2026-11-02",
      durationDays: 1,
      dependsOn: [],
    });
  });

  it("lets only owners archive or restore projects", async () => {
    const r = await makeRenovation(org.ownerCtx);
    await expectCode(setProjectArchived(org.memberCtx, r.project.id, true), "FORBIDDEN");
    await setProjectArchived(org.ownerCtx, r.project.id, true);
    await expectCode(setProjectArchived(org.memberCtx, r.project.id, false), "FORBIDDEN");
  });

  it("searches projects by name or address within the company only", async () => {
    await createProject(org.ownerCtx, { name: "Birchwood Kitchen", address: "9 Elm Road", startDate: "2026-11-02" });
    await createProject(org.ownerCtx, { name: "Oak Basement", address: "14 Birchwood Lane", startDate: "2026-11-02" });
    const other = await makeOrganization("Search Rival");
    await createProject(other.ownerCtx, {
      name: "Birchwood Rival Job",
      address: "1 Other St",
      startDate: "2026-11-02",
    });
    const names = (await listProjects(org.ownerCtx, "ACTIVE", "birchwood")).map((p) => p.name).sort();
    expect(names).toEqual(["Birchwood Kitchen", "Oak Basement"]);
  });

  it("requires an owner to approve follow-ups, and only once", async () => {
    const r = await makeRenovation(org.ownerCtx);
    const followUp = await createFollowUp(org.memberCtx, r.project.id, {
      message: "Can you confirm the electrical finish date?",
      taskId: r.electrical.id,
      subcontractorId: r.electrician.id,
    });
    expect(followUp.status).toBe("PENDING_APPROVAL");
    await expectCode(reviewFollowUp(org.memberCtx, followUp.id, "APPROVED"), "FORBIDDEN");
    await reviewFollowUp(org.ownerCtx, followUp.id, "APPROVED");
    await expectCode(reviewFollowUp(org.ownerCtx, followUp.id, "REJECTED"), "CONFLICT");
    const stored = await prisma.followUp.findUniqueOrThrow({ where: { id: followUp.id } });
    expect(stored).toMatchObject({ status: "APPROVED", reviewedById: org.owner.id });
  });

  it("treats an open blocking issue as a blocker until it is resolved", async () => {
    const r = await makeRenovation(org.ownerCtx);
    const issue = await createIssue(org.memberCtx, r.project.id, {
      title: "Utility disconnect not booked",
      severity: "HIGH",
      isBlocker: true,
      taskId: r.electrical.id,
    });
    let dash = await getDashboard(org.ownerCtx, d("2026-11-02"));
    expect(dash.blockers.find((b) => b.taskId === r.electrical.id)?.level).toBe("blocked");
    await resolveIssue(org.ownerCtx, issue.id);
    await expectCode(resolveIssue(org.ownerCtx, issue.id), "CONFLICT");
    dash = await getDashboard(org.ownerCtx, d("2026-11-02"));
    expect(dash.blockers.find((b) => b.taskId === r.electrical.id)).toBeUndefined();
  });

  it("writes an activity log entry in the same transaction as each change", async () => {
    const r = await makeRenovation(org.ownerCtx);
    await addSubcontractorToProject(org.ownerCtx, r.project.id, r.electrician.id);
    await expect(addSubcontractorToProject(org.ownerCtx, r.project.id, r.electrician.id)).rejects.toBeInstanceOf(
      AppError,
    );
    const actions = (
      await prisma.activityLog.findMany({ where: { organizationId: org.org.id }, orderBy: { createdAt: "asc" } })
    ).map((a) => a.action);
    expect(actions).toEqual([
      "project.created",
      "subcontractor.created",
      "task.created",
      "task.created",
      "task.created",
      "project.subcontractor_added",
    ]); // the failed duplicate add rolled back and left no log entry
  });

  it("rejects duplicate subcontractor names within a company", async () => {
    await createSubcontractor(org.ownerCtx, { companyName: "Same Name Ltd", trade: "PAINTING", contactName: "A" });
    await expectCode(
      createSubcontractor(org.ownerCtx, { companyName: "Same Name Ltd", trade: "PAINTING", contactName: "B" }),
      "CONFLICT",
    );
    const other = await makeOrganization("Other GC");
    await createSubcontractor(other.ownerCtx, { companyName: "Same Name Ltd", trade: "PAINTING", contactName: "C" }); // fine in another company
  });

  it("exports the schedule in the shared contract format", async () => {
    const r = await makeRenovation(org.ownerCtx);
    const exported = await exportSchedule(org.ownerCtx, r.project.id, d("2026-11-04"));
    expect(exported).toMatchObject({
      contract_version: "1.0",
      project_id: r.project.id,
      start_date: "2026-11-02",
      as_of: "2026-11-04",
    });
    const drywall = exported.tasks.find((t) => t.id === r.drywall.id)!;
    expect(drywall).toMatchObject({ trade: "drywall", duration_days: 5, status: "not_started" });
    expect(drywall.depends_on.sort()).toEqual([r.plumbing.id, r.electrical.id].sort());
  });
});
