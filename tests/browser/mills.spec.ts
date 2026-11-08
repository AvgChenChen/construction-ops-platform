import { expect, test } from '@playwright/test';

test('public Mills landing page explains the pilot and stays responsive', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Mills · AI coordination/);
  await expect(page.getByRole('heading', { name: 'A day late is a dollar short.' })).toBeVisible();
  await expect(page.getByText('ILLUSTRATIVE PILOT CONSOLE · MOCK MODE · HUMAN APPROVALS')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Book a pilot' })).toHaveAttribute('href', '#pilot');
  await expect(page.getByRole('link', { name: 'Contractor preview' })).toHaveAttribute('href', '/contractor');
  await expect(page.getByRole('heading', { name: 'One place for the schedule, the checklist, and the conversation.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/mills-landing-mobile.png', fullPage: true });
});

test('public Mills landing page captures a local pilot request without outbound activity', async ({ page }) => {
  await page.goto('/#pilot');
  await expect(page.getByRole('heading', { name: 'Bring us one active job.' })).toBeVisible();
  await expect(page.getByText('Local mock intake · no outbound messages')).toBeVisible();

  await page.getByLabel('Company').fill('Northline Build Group');
  await page.getByLabel('Your role').selectOption('Operations manager');
  await page.getByLabel('City').fill('Toronto');
  await page.getByLabel('Active jobs').selectOption('2 to 5 active jobs');
  await page.getByLabel('What keeps creating coordination work?').fill('Chasing delivery dates and subcontractor handoffs.');
  await page.getByLabel('Work email').fill('ops@northline.example');
  await page.getByRole('button', { name: 'Save pilot request' }).click();

  await expect(page.getByRole('status')).toContainText('Pilot request saved');
  await expect(page.getByText('No email was sent and no external account was contacted.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add another request' })).toBeVisible();
});

test('private Mills console keeps approval-gated mock coordination local', async ({ page }) => {
  await page.goto('/mills');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Workspace password').fill(process.env.DASHBOARD_PASSWORD!);
  await page.getByRole('button', { name: 'Open Mills' }).click();
  await expect(page).toHaveURL(/\/mills/);
  await expect(page.getByRole('heading', { name: 'Keep every trade in sync.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pilot board/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('PERSISTED PILOT')).toBeVisible();

  await page.getByLabel('Plumbing status').selectOption('DELAYED');
  await expect(page.getByText('Impact detected').first()).toBeVisible();
  const send = page.getByRole('button', { name: 'Record mock send' }).first();
  if (await send.count()) {
    const approval = send.locator('xpath=ancestor::article[1]').getByRole('checkbox', { name: /reviewed this draft/i });
    await expect(send).toBeDisabled();
    await approval.check();
    await send.click();
    await expect(page.getByText('Mock update recorded. No SMS was sent.')).toBeVisible();
  } else {
    await expect(page.getByRole('button', { name: 'Mock update recorded' }).first()).toBeVisible();
  }
  await page.reload();
  await expect(page.getByText('PERSISTED PILOT')).toBeVisible();
  await expect(page.getByLabel('Plumbing status')).toHaveValue('DELAYED');
  await expect(page.getByRole('button', { name: 'Mock update recorded' }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('contractor workspace shows a scoped trade view without outbound messaging', async ({ page }) => {
  await page.goto('/contractor');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Workspace password').fill(process.env.DASHBOARD_PASSWORD!);
  await page.getByRole('button', { name: 'Open Mills' }).click();
  await expect(page).toHaveURL(/\/contractor/);
  await expect(page.getByRole('heading', { name: 'Your work, without the group-text scramble.' })).toBeVisible();
  await expect(page.getByText('Contractor preview.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My schedule' })).toBeVisible();
  await expect(page.getByText('Scoped to this workspace')).toBeVisible();
  await expect(page.getByLabel('Current status')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Mills headquarters keeps customer health and onboarding in view', async ({ page }) => {
  await page.goto('/hq');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Workspace password').fill(process.env.DASHBOARD_PASSWORD!);
  await page.getByRole('button', { name: 'Open Mills' }).click();
  await expect(page).toHaveURL(/\/hq/);
  await expect(page.getByRole('heading', { name: 'Run the company from one calm place.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Overview/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('CUSTOMER HEALTH', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Customers/i }).click();
  await expect(page.getByRole('heading', { name: 'Every account, with the next useful action.' })).toBeVisible();
  await page.getByLabel('Search customers').fill('Toronto');
  await expect(page.getByText('Toronto Renovation Co.')).toBeVisible();
  await page.getByRole('button', { name: /Onboarding/i }).click();
  await expect(page.getByRole('heading', { name: 'Move a customer from first hello to first saved day.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Mills headquarters growth console keeps marketing drafts approval-gated', async ({ page }) => {
  await page.goto('/hq');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Workspace password').fill(process.env.DASHBOARD_PASSWORD!);
  await page.getByRole('button', { name: 'Open Mills' }).click();
  await expect(page).toHaveURL(/\/hq/);

  await page.getByRole('button', { name: /Growth/i }).click();
  await expect(page.getByRole('button', { name: /Growth/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Turn useful conversations into pilots.' })).toBeVisible();
  await expect(page.getByText('Mock mode · no outbound activity')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Each channel has a clear job.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Publish a useful point of view.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Keep the next conversation visible.' })).toBeVisible();
  await expect(page.getByText('Human approval required')).toBeVisible();

  const draft = page.getByRole('article').filter({ hasText: 'The 7:02 AM delivery problem' });
  await expect(draft.getByText('Draft', { exact: true })).toBeVisible();
  await draft.getByRole('button', { name: 'Approve draft' }).click();
  await expect(draft.getByText('Approved', { exact: true })).toBeVisible();
  await expect(page.getByText('approved locally')).toBeVisible();
  await expect(page.getByText('No email, LinkedIn message, or social post is sent from HQ.')).toBeVisible();
});
