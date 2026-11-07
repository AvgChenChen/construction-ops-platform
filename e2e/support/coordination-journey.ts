import { expect, type Browser, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { addWorkingDays, nextWorkingDayOnOrAfter, todayInTimeZone, toISODate } from "../../src/lib/domain/calendar";

/**
 * Core coordination journey, driven through the real UI and real permissions:
 * GC owner builds a project with an upstream plumbing task and a downstream electrical task,
 * records a delay on plumbing, sees the downstream impact, drafts a follow-up, and approves it.
 *
 * Fixtures live in the seeded demo tenants (Northline = org A, Granite Peak = org B) and every
 * record this run creates carries RUN in its name, so cleanup touches only this run's rows.
 */
export const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "demo-password-2026";
export const OWNER = "dana@northline.example";
export const MEMBER = "sam@northline.example";
export const OTHER_ORG = "lee@granitepeak.example";

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Dates are computed in the same zone the server uses for "today", so the scenario holds on any run date. */
export function scheduleDates() {
  const today = todayInTimeZone(process.env.APP_TIMEZONE ?? "America/Toronto");
  const start = nextWorkingDayOnOrAfter(today);
  return {
    plumbingStart: toISODate(start), // 2 working days
    electricalStart: toISODate(addWorkingDays(start, 2)), // starts the working day after plumbing ends
  };
}

/**
 * Administrative fixture setup (isolated test database only): directory entries are created
 * directly, because the "Add subcontractor" dialog has a known defect that is tested on its own
 * in e2e/known-defects.spec.ts. Assigning them to the project still goes through the UI.
 */
async function addSubcontractors(names: { companyName: string; trade: "PLUMBING" | "ELECTRICAL" | "ROOFING" }[]) {
  const prisma = new PrismaClient();
  try {
    const org = await prisma.organization.findFirstOrThrow({ where: { users: { some: { email: OWNER } } } });
    for (const n of names) {
      await prisma.subcontractor.create({
        data: { organizationId: org.id, companyName: n.companyName, trade: n.trade, contactName: "Test Contact" },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function addTask(page: Page, t: { name: string; trade: string; sub: string; start: string; days: number }) {
  await page.getByRole("button", { name: "Add task" }).click();
  const dialog = page.getByRole("dialog", { name: "Add task" });
  await dialog.getByLabel("Task name").fill(t.name);
  await dialog.getByLabel("Trade", { exact: true }).selectOption(t.trade);
  await dialog.getByLabel("Subcontractor").selectOption({ label: t.sub });
  await dialog.getByLabel("Planned start").fill(t.start);
  await dialog.getByLabel("Duration (working days)").fill(String(t.days));
  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("schedule-table")).toContainText(t.name);
}

async function draftFollowUp(page: Page, message: string, sub: string, task: string) {
  await page.getByRole("button", { name: "Draft follow-up" }).click();
  const dialog = page.getByRole("dialog", { name: "Draft a follow-up" });
  await dialog.getByLabel("Message").fill(message);
  await dialog.getByLabel("Subcontractor").selectOption({ label: sub });
  await dialog.getByLabel("Task").selectOption({ label: task });
  await dialog.getByRole("button", { name: "Submit for approval" }).click();
  await expect(dialog).toBeHidden();
  return followUpItem(page, message);
}

export const followUpItem = (page: Page, message: string) => page.locator("#follow-ups li", { hasText: message });
const activityItems = (page: Page, text: string) => page.getByTestId("activity-feed").locator("li", { hasText: text });

export async function runCoordinationJourney(browser: Browser, page: Page, run: string) {
  const plumber = `Plumb ${run}`;
  const electrician = `Spark ${run}`;
  const unrelated = `Unrelated Roofing ${run}`;
  const projectName = `QA Coordination ${run}`;
  const { plumbingStart, electricalStart } = scheduleDates();

  // 1. Directory: two project subcontractors and one unrelated subcontractor (fixture setup).
  await addSubcontractors([
    { companyName: plumber, trade: "PLUMBING" },
    { companyName: electrician, trade: "ELECTRICAL" },
    { companyName: unrelated, trade: "ROOFING" },
  ]);
  await signIn(page, OWNER);

  // 2. Project, and assign only the plumber and electrician to it.
  await page.goto("/projects/new");
  await page.getByLabel("Project name").fill(projectName);
  await page.getByLabel("Site address").fill("1 QA Street, Toronto, ON");
  await page.getByLabel("Start date").fill(plumbingStart);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: projectName, level: 1 })).toBeVisible();
  const projectUrl = page.url();
  const projectId = projectUrl.split("/projects/")[1];
  for (const [sub, n] of [
    [`${plumber} (Plumbing)`, 1],
    [`${electrician} (Electrical)`, 2],
  ] as const) {
    await page.getByLabel("Add from your directory").selectOption({ label: sub });
    await page.getByRole("button", { name: "Add to project" }).click();
    await expect(page.getByRole("heading", { name: `Subcontractors on this project (${n})` })).toBeVisible();
  }

  // 3. Tasks with responsible subcontractors.
  await addTask(page, { name: "Plumbing rough-in", trade: "PLUMBING", sub: plumber, start: plumbingStart, days: 2 });
  await addTask(page, {
    name: "Electrical rough-in",
    trade: "ELECTRICAL",
    sub: electrician,
    start: electricalStart,
    days: 3,
  });

  // 4. Dependency, created from the downstream task page.
  await page.getByTestId("schedule-table").getByRole("link", { name: "Electrical rough-in" }).click();
  await expect(page.getByRole("heading", { name: "Electrical rough-in", level: 1 })).toBeVisible();
  const electricalUrl = page.url();
  await expect(page.getByText(`Electrical · ${electrician}`)).toBeVisible();
  await page.getByLabel("Must finish first").selectOption({ label: "Plumbing rough-in" });
  await page.getByRole("button", { name: "Add dependency" }).click();
  await expect(page.getByRole("link", { name: "Plumbing rough-in" })).toBeVisible();
  await expect(page.getByText("Waiting on unfinished work")).toBeVisible();

  // 5. Delay reported on the upstream task (entered by the GC: subcontractors have no login and SMS isn't built).
  await page.getByRole("link", { name: "Plumbing rough-in" }).click();
  await expect(page.getByRole("heading", { name: "Plumbing rough-in", level: 1 })).toBeVisible();
  const plumbingUrl = page.url();
  await expect(page.getByRole("link", { name: "Electrical rough-in" })).toBeVisible(); // "Tasks waiting on this one"
  const delayNote = `Sub called: fixtures backordered, 2-day delay (${run})`;
  await page.getByLabel("Status").selectOption("BLOCKED");
  await page.getByLabel("Percent complete").fill("20");
  await page.getByLabel("What changed on site?").fill(delayNote);
  await page.getByRole("button", { name: "Save update" }).click();
  await expect(page.getByTestId("progress-history")).toContainText(delayNote);
  await page.reload();
  await expect(page.getByTestId("progress-history").locator("li", { hasText: delayNote })).toContainText("Blocked");
  await expect(page.getByTestId("progress-history").locator("li", { hasText: delayNote })).toContainText("20%");

  // 6. Downstream impact is visible to the GC on the project page.
  await page.goto(projectUrl);
  const blockers = page.getByTestId("blocker-list");
  await expect(blockers.locator(":scope > li", { hasText: "Plumbing rough-in" }).first()).toContainText("Blocked");
  const downstream = blockers.locator(":scope > li", { hasText: "Electrical rough-in" }).first();
  await expect(downstream).toContainText("At risk");
  await expect(downstream).toContainText("waiting on Plumbing rough-in (blocked, 20%)");

  // 7. Proposal: only project subcontractors are offered as recipients.
  await page.getByRole("button", { name: "Draft follow-up" }).click();
  const recipients = page.getByRole("dialog", { name: "Draft a follow-up" }).getByLabel("Subcontractor");
  await expect(recipients.locator("option", { hasText: unrelated })).toHaveCount(0);
  await page.keyboard.press("Escape");
  const message = `Plumbing is 2 days late; can electrical start ${run} shift? (approve)`;
  const item = await draftFollowUp(page, message, electrician, "Electrical rough-in");
  await expect(item).toContainText("Pending");
  await expect(item).toContainText(`To ${electrician}`);
  await expect(activityItems(page, `Drafted follow-up for approval`).filter({ hasText: run })).toHaveCount(1);
  await expect(activityItems(page, "Approved follow-up").filter({ hasText: run })).toHaveCount(0);

  // 8. A member sees it but cannot approve; another company cannot see the project at all.
  const memberCtx = await browser.newContext();
  const member = await memberCtx.newPage();
  await signIn(member, MEMBER);
  await member.goto(projectUrl);
  await expect(followUpItem(member, message)).toContainText("Waiting for owner approval");
  await expect(followUpItem(member, message).getByRole("button", { name: "Approve" })).toHaveCount(0);
  await memberCtx.close();

  const otherCtx = await browser.newContext();
  const other = await otherCtx.newPage();
  await signIn(other, OTHER_ORG);
  for (const url of [projectUrl, plumbingUrl, electricalUrl]) {
    expect((await other.goto(url))?.status(), url).toBe(404);
  }
  expect((await other.request.get(`/api/projects/${projectId}/schedule-export`)).status()).toBe(404);
  await otherCtx.close();

  // 9. URL tampering inside org A: a real task id under a different project id is a 404.
  const taskId = plumbingUrl.split("/tasks/")[1];
  expect((await page.goto(`/projects/prj_maple_ridge/tasks/${taskId}`))?.status()).toBe(404);

  // 10. Owner approves; state and history persist across a refresh.
  await page.goto(projectUrl);
  await followUpItem(page, message).getByRole("button", { name: "Approve" }).click();
  await expect(followUpItem(page, message)).toContainText("Approved by Dana Okafor");
  await page.reload();
  await expect(followUpItem(page, message)).toContainText("Approved");
  await expect(followUpItem(page, message).getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(activityItems(page, "Approved follow-up").filter({ hasText: run })).toHaveCount(1);
  await expect(activityItems(page, `"Plumbing rough-in": blocked, 20%`)).toHaveCount(1);

  // 11. Double-click on Approve for a second proposal records exactly one approval.
  const dbl = `Second proposal ${run} (double-click)`;
  await draftFollowUp(page, dbl, plumber, "Plumbing rough-in");
  await followUpItem(page, dbl).getByRole("button", { name: "Approve" }).dblclick();
  await expect(followUpItem(page, dbl)).toContainText("Approved by Dana Okafor");
  await page.reload();
  await expect(activityItems(page, "Approved follow-up").filter({ hasText: "Second proposal" })).toHaveCount(1);

  // 12. Rejection: recorded as rejected, never approved.
  const rej = `Third proposal ${run} (reject)`;
  await draftFollowUp(page, rej, electrician, "Electrical rough-in");
  await followUpItem(page, rej).getByRole("button", { name: "Reject" }).click();
  await page
    .getByRole("dialog", { name: "Reject this follow-up?" })
    .getByRole("button", { name: "Reject follow-up" })
    .click();
  await expect(followUpItem(page, rej)).toContainText("Rejected by Dana Okafor");
  await page.reload();
  await expect(activityItems(page, "Rejected follow-up").filter({ hasText: "Third proposal" })).toHaveCount(1);
  await expect(activityItems(page, "Approved follow-up").filter({ hasText: "Third proposal" })).toHaveCount(0);
}

/** Deletes only rows whose names carry this run's tag, inside the seeded demo tenant. */
export async function cleanupRun(run: string) {
  const prisma = new PrismaClient();
  try {
    const org = await prisma.organization.findFirst({ where: { users: { some: { email: OWNER } } } });
    if (!org) return;
    const subs = await prisma.subcontractor.findMany({
      where: { organizationId: org.id, companyName: { contains: run } },
      select: { id: true },
    });
    await prisma.project.deleteMany({ where: { organizationId: org.id, name: { contains: run } } }); // cascades
    await prisma.activityLog.deleteMany({ where: { organizationId: org.id, entityId: { in: subs.map((s) => s.id) } } });
    await prisma.subcontractor.deleteMany({ where: { id: { in: subs.map((s) => s.id) } } });
  } finally {
    await prisma.$disconnect();
  }
}
