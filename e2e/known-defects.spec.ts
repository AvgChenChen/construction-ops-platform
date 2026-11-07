import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { OWNER, cleanupRun, signIn } from "./support/coordination-journey";

/**
 * KNOWN DEFECT (found 2026-11-07, root cause not yet identified):
 * On /subcontractors and /dashboard, the Server Action saves its data (verified in the database)
 * but the browser never leaves the pending state: the dialog stays open on "Adding…", or the
 * button stays on "Approving". Reloading shows the correct saved state. The same actions on the
 * project and task pages settle normally.
 *
 * Reproduced locally with @playwright/test 1.56.1 driving a newer preinstalled Chromium (build 1243).
 * Not yet confirmed with the pinned browser, so CI's result is the next data point:
 * `test.fail()` passes while the defect reproduces and FAILS ("expected to fail, but passed")
 * once it no longer does. If that happens, delete `test.fail()` rather than the test.
 */
const RUN = `kd-${Date.now().toString(36)}`;
test.afterAll(() => cleanupRun(RUN));

/** Fixture: a run-tagged project with one pending follow-up, so seeded data is never touched. */
async function pendingFollowUp(message: string) {
  const prisma = new PrismaClient();
  try {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: OWNER } });
    const project = await prisma.project.create({
      data: {
        organizationId: owner.organizationId,
        name: `Known Defect ${RUN}`,
        address: "1 QA St",
        startDate: new Date(),
      },
    });
    await prisma.followUp.create({
      data: { organizationId: owner.organizationId, projectId: project.id, message, createdById: owner.id },
    });
  } finally {
    await prisma.$disconnect();
  }
}

test("adding a subcontractor closes the dialog and lists it", async ({ page }) => {
  test.fail(true, "Known defect: Server Action on /subcontractors never settles in the browser");
  await signIn(page, OWNER);
  await page.goto("/subcontractors");
  await page.getByRole("button", { name: "Add subcontractor" }).click();
  const dialog = page.getByRole("dialog", { name: "Add subcontractor" });
  await dialog.getByLabel("Company name").fill(`Known Defect Sub ${RUN}`);
  await dialog.getByLabel("Trade").selectOption("OTHER");
  await dialog.getByLabel("Contact name").fill("Test Contact");
  await dialog.getByRole("button", { name: "Add subcontractor" }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
  await expect(page.getByTestId("subcontractor-table")).toContainText(`Known Defect Sub ${RUN}`);
});

test("approving a follow-up from the dashboard settles and removes it from the queue", async ({ page }) => {
  test.fail(true, "Known defect: Server Action on /dashboard never settles in the browser");
  const message = `Known defect follow-up ${RUN}`;
  await pendingFollowUp(message);
  await signIn(page, OWNER);
  const queue = page.getByTestId("pending-follow-ups");
  await queue.locator("li", { hasText: message }).getByRole("button", { name: "Approve" }).click();
  await expect(queue).not.toContainText(message, { timeout: 10_000 });
});
