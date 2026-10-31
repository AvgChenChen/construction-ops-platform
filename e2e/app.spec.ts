import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "demo-password-2026";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/projects/prj_maple_ridge");
  await expect(page).toHaveURL(/\/login\?next=%2Fprojects%2Fprj_maple_ridge/);
  const api = await page.request.get("/api/projects/prj_maple_ridge/schedule-export");
  expect(api.status()).toBe(401);
});

test("wrong password shows an error and does not sign in", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("dana@northline.example");
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Filter by text: Next.js also renders an empty role="alert" route announcer.
  await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password" })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Email")).toHaveValue("dana@northline.example"); // input survives a failed attempt
});

test("dashboard shows drywall at risk because electrical isn't finished", async ({ page }) => {
  await signIn(page, "dana@northline.example");
  const blockers = page.getByTestId("blocker-list");
  const drywall = blockers.locator("li", { hasText: "Drywall hang, tape & mud" }).first();
  await expect(drywall).toContainText("At risk");
  await expect(drywall).toContainText("Root cause upstream: Electrical rough-in (60%)");
  await expect(blockers.locator("li", { hasText: "Electrical rough-in" }).first()).toContainText("Blocked");
  await expect(page.getByTestId("pending-follow-ups")).toContainText(
    "confirm when the second-floor rough-in will be finished",
  );
});

test("an owner can create a project, add a task, and archive it", async ({ page }) => {
  await signIn(page, "dana@northline.example");
  await page.goto("/projects/new");
  const name = `E2E Bathroom Refresh ${Date.now()}`;
  await page.getByLabel("Project name").fill(name);
  await page.getByLabel("Site address").fill("7 Test Lane, Toronto, ON");
  await page.getByLabel("Start date").fill("2026-11-02");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  await page.getByRole("button", { name: "Add task" }).click();
  const dialog = page.getByRole("dialog", { name: "Add task" });
  // Submitting an empty form shows server-side validation errors and keeps the dialog open.
  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Please fix the highlighted fields");
  await dialog.getByLabel("Task name").fill("Tile removal");
  await dialog.getByLabel("Trade", { exact: true }).selectOption("DEMOLITION");
  await dialog.getByLabel("Planned start").fill("2026-11-02");
  await dialog.getByLabel("Duration (working days)").fill("2");
  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("schedule-table")).toContainText("Tile removal");

  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Archive this project?" })
    .getByRole("button", { name: "Archive project" })
    .click();
  await expect(page.getByText("This project is archived and read-only")).toBeVisible();
  await page.goto("/projects");
  await expect(page.getByTestId("project-list")).not.toContainText(name);
});

test("a member can draft follow-ups but cannot approve them or archive projects", async ({ page }) => {
  await signIn(page, "sam@northline.example");
  await expect(page.getByTestId("pending-follow-ups")).toContainText("Waiting for owner approval");
  await expect(page.getByTestId("pending-follow-ups").getByRole("button", { name: "Approve" })).toHaveCount(0);
  await page.goto("/projects/prj_maple_ridge");
  await expect(page.getByRole("button", { name: "Archive", exact: true })).toHaveCount(0);
});

test("schedule filters run on the server and keep the URL shareable", async ({ page }) => {
  await signIn(page, "dana@northline.example");
  await page.goto("/projects/prj_maple_ridge");
  await page.getByLabel("Status").selectOption("complete");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/status=complete/);
  const table = page.getByTestId("schedule-table");
  await expect(table).toContainText("Plumbing rough-in");
  await expect(table).not.toContainText("Drywall hang, tape & mud");
  await expect(page.getByText("Showing 4 of 12 tasks")).toBeVisible();
});

test("another company cannot open Northline's project or its API", async ({ page }) => {
  await signIn(page, "lee@granitepeak.example");
  const response = await page.goto("/projects/prj_maple_ridge");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("belongs to a different company account")).toBeVisible();
  const api = await page.request.get("/api/projects/prj_maple_ridge/schedule-export");
  expect(api.status()).toBe(404);
  await page.goto("/dashboard");
  await expect(page.getByTestId("current-user")).toHaveText("Lee Park");
  await expect(page.getByText("Maple Ridge")).toHaveCount(0);
});
