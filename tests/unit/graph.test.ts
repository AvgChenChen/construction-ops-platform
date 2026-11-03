import { describe, expect, it } from "vitest";
import { wouldCreateCycle } from "@/lib/domain/graph";

const edges = [
  { taskId: "drywall", dependsOnId: "electrical" },
  { taskId: "painting", dependsOnId: "drywall" },
];

describe("wouldCreateCycle", () => {
  it("rejects self-dependencies", () => {
    expect(wouldCreateCycle(edges, "drywall", "drywall")).toBe(true);
  });
  it("rejects edges that close a loop, directly or transitively", () => {
    expect(wouldCreateCycle(edges, "electrical", "drywall")).toBe(true);
    expect(wouldCreateCycle(edges, "electrical", "painting")).toBe(true);
  });
  it("allows edges that keep the graph acyclic", () => {
    expect(wouldCreateCycle(edges, "painting", "electrical")).toBe(false);
    expect(wouldCreateCycle(edges, "flooring", "painting")).toBe(false);
    expect(wouldCreateCycle([], "a", "b")).toBe(false);
  });

  // OPS-005 edge cases.
  const chain = (n: number) =>
    Array.from({ length: n - 1 }, (_, i) => ({ taskId: `t${i + 2}`, dependsOnId: `t${i + 1}` })); // t2 waits on t1, ...

  it("rejects a task depending on itself, and copes with a self-loop already in the data", () => {
    expect(wouldCreateCycle([], "a", "a")).toBe(true);
    const withSelfLoop = [...edges, { taskId: "electrical", dependsOnId: "electrical" }];
    expect(wouldCreateCycle(withSelfLoop, "flooring", "electrical")).toBe(false); // terminates, unrelated edge allowed
    expect(wouldCreateCycle(withSelfLoop, "electrical", "painting")).toBe(true);
  });

  it("finds a cycle closed at the end of a 200-task chain", () => {
    const edges200 = chain(200);
    expect(wouldCreateCycle(edges200, "t1", "t200")).toBe(true); // t1 would wait on t200, which waits on t1
    expect(wouldCreateCycle(edges200, "t201", "t200")).toBe(false); // extending the chain is fine
    expect(wouldCreateCycle(edges200, "t200", "t1")).toBe(false); // a shortcut that already holds indirectly
  });

  it("allows a diamond, and rejects closing it", () => {
    // b and c wait on a; d waits on both b and c.
    const diamond = [
      { taskId: "b", dependsOnId: "a" },
      { taskId: "c", dependsOnId: "a" },
      { taskId: "d", dependsOnId: "b" },
      { taskId: "d", dependsOnId: "c" },
    ];
    expect(wouldCreateCycle(diamond, "d", "a")).toBe(false); // redundant, but not circular
    expect(wouldCreateCycle(diamond, "a", "d")).toBe(true);
  });

  it("visits each task once, so stacked diamonds stay fast (checks the O(V + E) claim)", () => {
    // 40 diamonds in a row have 2^40 upstream paths; without the `seen` set this would never finish.
    const ladder = Array.from({ length: 40 }, (_, i) => [
      { taskId: `l${i}`, dependsOnId: `j${i}` },
      { taskId: `r${i}`, dependsOnId: `j${i}` },
      { taskId: `j${i + 1}`, dependsOnId: `l${i}` },
      { taskId: `j${i + 1}`, dependsOnId: `r${i}` },
    ]).flat();
    const started = performance.now();
    expect(wouldCreateCycle(ladder, "j0", "j40")).toBe(true);
    expect(wouldCreateCycle(ladder, "end", "j40")).toBe(false);
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("is iterative, so a 100,000-task chain doesn't overflow the call stack", () => {
    expect(wouldCreateCycle(chain(100_000), "t1", "t100000")).toBe(true);
  });
});
