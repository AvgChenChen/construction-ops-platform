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
});
