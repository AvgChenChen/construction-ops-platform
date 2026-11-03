export type Edge = { taskId: string; dependsOnId: string };

/**
 * Would adding "taskId depends on dependsOnId" create a circular dependency?
 *
 * It would if taskId is already an ancestor of dependsOnId, i.e. if dependsOnId
 * (directly or indirectly) already waits on taskId. We walk upstream from
 * dependsOnId with an iterative DFS (an explicit stack, so long chains can't overflow
 * the call stack).
 *
 * O(V + E) time and space for V tasks and E edges: building the map reads each edge once,
 * and the `seen` set expands each task at most once, so each edge is followed at most
 * once. Without `seen`, stacked diamonds would be walked once per path (exponential).
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
