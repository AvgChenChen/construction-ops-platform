export type Edge = { taskId: string; dependsOnId: string };

/**
 * Would adding "taskId depends on dependsOnId" create a circular dependency?
 *
 * It would if taskId is already an ancestor of dependsOnId, i.e. if dependsOnId
 * (directly or indirectly) already waits on taskId. We walk upstream from
 * dependsOnId with an iterative DFS. O(V + E).
 */
export function wouldCreateCycle(edges: Edge[], taskId: string, dependsOnId: string): boolean {
  if (taskId === dependsOnId) return true;
  const predecessors = new Map<string, string[]>();
  for (const e of edges) {
    const list = predecessors.get(e.taskId) ?? [];
    list.push(e.dependsOnId);
    predecessors.set(e.taskId, list);
  }
  const stack = [dependsOnId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const p of predecessors.get(current) ?? []) stack.push(p);
  }
  return false;
}
