import { test } from "@playwright/test";
import { cleanupRun, runCoordinationJourney } from "./support/coordination-journey";

const RUN = `qa-${process.pid}-${Date.now().toString(36)}`;
test.afterAll(() => cleanupRun(RUN));

test("core coordination journey: delay -> downstream impact -> proposal -> owner approval, recorded once", async ({
  browser,
  page,
}) => {
  test.setTimeout(90_000);
  await runCoordinationJourney(browser, page, RUN);
});
