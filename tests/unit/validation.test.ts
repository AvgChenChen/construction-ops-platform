import { describe, expect, it } from "vitest";
import {
  formDataToObject,
  issueSchema,
  progressSchema,
  projectSchema,
  signUpSchema,
  taskSchema,
} from "@/lib/validation";

describe("server-side validation", () => {
  it("normalizes email and enforces password length", () => {
    const ok = signUpSchema.safeParse({
      organizationName: "GC",
      name: "A",
      email: "  Dana@Example.COM ",
      password: "0123456789",
    });
    expect(ok.success && ok.data.email).toBe("dana@example.com");
    expect(
      signUpSchema.safeParse({ organizationName: "GC", name: "A", email: "a@b.co", password: "short" }).success,
    ).toBe(false);
  });

  it("rejects a target end date before the start date", () => {
    const r = projectSchema.safeParse({
      name: "Job",
      address: "1 Main St",
      startDate: "2026-11-10",
      targetEndDate: "2026-11-01",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["targetEndDate"]);
  });

  it("treats blank optional fields as missing", () => {
    const r = projectSchema.parse({
      name: "Job",
      address: "1 Main St",
      startDate: "2026-11-10",
      targetEndDate: "",
      clientName: "  ",
    });
    expect(r.targetEndDate).toBeUndefined();
    expect(r.clientName).toBeUndefined();
  });

  it("gives exactly one clear message for an empty date", () => {
    const r = taskSchema.safeParse({ name: "Tile", trade: "OTHER", plannedStart: "", durationDays: "2" });
    expect(r.error?.issues.filter((i) => i.path[0] === "plannedStart").map((i) => i.message)).toEqual([
      "Date is required",
    ]);
  });

  it("rejects impossible dates and non-integer durations", () => {
    expect(
      taskSchema.safeParse({ name: "Tile", trade: "OTHER", plannedStart: "2026-02-30", durationDays: "2" }).success,
    ).toBe(false);
    expect(
      taskSchema.safeParse({ name: "Tile", trade: "OTHER", plannedStart: "2026-11-02", durationDays: "1.5" }).success,
    ).toBe(false);
    expect(
      taskSchema.safeParse({ name: "Tile", trade: "NOT_A_TRADE", plannedStart: "2026-11-02", durationDays: "2" })
        .success,
    ).toBe(false);
    expect(
      taskSchema.parse({ name: "Tile", trade: "OTHER", plannedStart: "2026-11-02", durationDays: "2" }).durationDays,
    ).toBe(2);
  });

  it("forces COMPLETE progress to 100% and bounds percentages", () => {
    expect(progressSchema.parse({ status: "COMPLETE", percentComplete: "40", note: "done" }).percentComplete).toBe(100);
    expect(progressSchema.safeParse({ status: "IN_PROGRESS", percentComplete: "140", note: "x" }).success).toBe(false);
  });

  it("parses checkbox values", () => {
    expect(issueSchema.parse({ title: "Leak", severity: "HIGH", isBlocker: "on" }).isBlocker).toBe(true);
    expect(issueSchema.parse({ title: "Leak", severity: "HIGH" }).isBlocker).toBe(false);
  });

  it("converts FormData, keeping every value for array fields and dropping Next internals", () => {
    const fd = new FormData();
    fd.append("name", "Drywall");
    fd.append("dependsOn", "a");
    fd.append("dependsOn", "b");
    fd.append("$ACTION_ID_123", "");
    expect(formDataToObject(fd, ["dependsOn"])).toEqual({ name: "Drywall", dependsOn: ["a", "b"] });
    expect(formDataToObject(new FormData(), ["dependsOn"])).toEqual({ dependsOn: [] });
  });
});
