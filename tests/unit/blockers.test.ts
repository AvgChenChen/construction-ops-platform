import { describe, expect, it } from "vitest";
import { detectBlockers, projectProgress, type BlockerTask } from "@/lib/domain/blockers";
import { parseISODate } from "@/lib/domain/calendar";

const d = parseISODate;

function task(id: string, partial: Partial<BlockerTask> & { start: string; end: string }): BlockerTask {
  return {
    id,
    name: partial.name ?? id,
    status: partial.status ?? "NOT_STARTED",
    percentComplete: partial.percentComplete ?? 0,
    plannedStart: d(partial.start),
    plannedEnd: d(partial.end),
    dependsOn: partial.dependsOn ?? [],
  };
}

// The scenario from the brief: plumbing done, electrical not done, drywall next.
const renovation = () => [
  task("plumbing", {
    name: "Plumbing rough-in",
    status: "COMPLETE",
    percentComplete: 100,
    start: "2026-10-26",
    end: "2026-10-29",
  }),
  task("electrical", {
    name: "Electrical rough-in",
    status: "IN_PROGRESS",
    percentComplete: 60,
    start: "2026-10-26",
    end: "2026-10-30",
  }),
  task("inspection", {
    name: "Rough-in inspection",
    start: "2026-11-04",
    end: "2026-11-04",
    dependsOn: ["plumbing", "electrical"],
  }),
  task("drywall", { name: "Drywall", start: "2026-11-06", end: "2026-11-13", dependsOn: ["inspection"] }),
  task("painting", { name: "Painting", start: "2026-11-16", end: "2026-11-19", dependsOn: ["drywall"] }),
];

describe("detectBlockers", () => {
  it("flags drywall as at risk and traces the root cause to electrical", () => {
    const result = detectBlockers(renovation(), [], d("2026-11-02"));
    const drywall = result.find((b) => b.taskId === "drywall")!;
    expect(drywall.level).toBe("at_risk");
    expect(drywall.waitingOn.map((w) => w.id)).toEqual(["inspection"]);
    expect(drywall.rootCauses.map((r) => r.id)).toEqual(["electrical"]);
    expect(drywall.rootCauses[0].overdue).toBe(true);
    expect(drywall.reasons.join(" ")).toContain("Root cause upstream: Electrical rough-in (60%)");
  });

  it("marks a task blocked once it should have started but a predecessor is still open", () => {
    const result = detectBlockers(renovation(), [], d("2026-11-04"));
    expect(result.find((b) => b.taskId === "inspection")?.level).toBe("blocked");
    expect(result[0].level).toBe("blocked"); // blocked items sort first
  });

  it("flags the late task itself as at risk", () => {
    const electrical = detectBlockers(renovation(), [], d("2026-11-02")).find((b) => b.taskId === "electrical")!;
    expect(electrical.level).toBe("at_risk");
    expect(electrical.reasons[0]).toMatch(/now 1 working day late at 60%/);
  });

  it("ignores tasks outside the look-ahead window and completed tasks", () => {
    const ids = detectBlockers(renovation(), [], d("2026-11-02")).map((b) => b.taskId);
    expect(ids).not.toContain("painting"); // starts in 10 working days
    expect(ids).not.toContain("plumbing");
  });

  it("moves the root cause to the inspection once electrical is complete", () => {
    const tasks = renovation().map((t) =>
      t.id === "electrical" ? { ...t, status: "COMPLETE" as const, percentComplete: 100 } : t,
    );
    const result = detectBlockers(tasks, [], d("2026-11-02"));
    expect(result.map((b) => b.taskId)).toEqual(["drywall"]); // inspection itself isn't due yet and has no open predecessors
    expect(result[0].rootCauses.map((r) => r.id)).toEqual(["inspection"]);
    expect(result.some((b) => b.level === "blocked")).toBe(false);
  });

  it("returns nothing when every predecessor is complete", () => {
    const tasks = renovation().map((t) =>
      ["electrical", "inspection"].includes(t.id) ? { ...t, status: "COMPLETE" as const, percentComplete: 100 } : t,
    );
    expect(detectBlockers(tasks, [], d("2026-11-02"))).toEqual([]);
  });

  it("treats explicit BLOCKED status and open blocking issues as blocked", () => {
    const tasks = [
      task("a", { start: "2026-11-10", end: "2026-11-11", status: "BLOCKED" }),
      task("b", { start: "2026-11-10", end: "2026-11-11" }),
    ];
    const result = detectBlockers(
      tasks,
      [
        { taskId: "b", title: "Wrong fixtures delivered", isBlocker: true, status: "OPEN" },
        { taskId: "a", title: "Old problem", isBlocker: true, status: "RESOLVED" },
      ],
      d("2026-11-02"),
    );
    expect(result.map((r) => [r.taskId, r.level])).toEqual([
      ["a", "blocked"],
      ["b", "blocked"],
    ]);
    expect(result[1].reasons).toContain("Open blocking issue: Wrong fixtures delivered");
  });
});

describe("projectProgress", () => {
  it("weights progress by duration", () => {
    expect(projectProgress([])).toBe(0);
    expect(
      projectProgress([
        { durationDays: 3, percentComplete: 100, status: "COMPLETE" },
        { durationDays: 1, percentComplete: 0, status: "NOT_STARTED" },
      ]),
    ).toBe(75);
  });
});
