// One-dimensional bin packing by branch and bound. Pure and deterministic.

export interface BinPackResult {
  /** Item indexes per bin. */
  bins: number[][];
  /** False when the search budget ran out before every alternative was ruled out. */
  proven: boolean;
}

/**
 * Ranks packings, in order of priority:
 * 1. fewer bins,
 * 2. lower total cost,
 * 3. fuller fullest bins, which leaves the largest single leftover.
 *
 * `sizes` are positive integers sorted descending, none larger than `capacity`.
 */
export function binPack(
  sizes: number[],
  capacity: number,
  cost: (load: number) => number,
  nodeBudget = 200_000,
): BinPackResult {
  const remaining = new Array<number>(sizes.length + 1).fill(0);
  for (let i = sizes.length - 1; i >= 0; i--) remaining[i] = remaining[i + 1]! + sizes[i]!;

  // First Fit Decreasing is the starting answer, so a cut-off search never does worse.
  const firstFit: number[] = [];
  const loads: number[] = [];
  sizes.forEach((size, i) => {
    let bin = loads.findIndex((load) => load + size <= capacity);
    if (bin < 0) bin = loads.push(0) - 1;
    loads[bin]! += size;
    firstFit[i] = bin;
  });

  const score = (binLoads: number[]) => ({
    count: binLoads.length,
    cost: binLoads.reduce((sum, load) => sum + cost(load), 0),
    fill: binLoads.reduce((sum, load) => sum + (load / capacity) ** 2, 0),
  });
  const better = (a: ReturnType<typeof score>, b: ReturnType<typeof score>) =>
    a.count !== b.count
      ? a.count < b.count
      : a.cost !== b.cost
        ? a.cost < b.cost
        : a.fill > b.fill + 1e-9;

  let best = score(loads);
  let bestAssignment = firstFit.slice();
  let nodes = 0;
  let proven = true;

  const assignment: number[] = [];
  const open: number[] = [];
  let free = 0;

  const search = (i: number) => {
    if (i === sizes.length) {
      const candidate = score(open);
      if (better(candidate, best)) {
        best = candidate;
        bestAssignment = assignment.slice();
      }
      return;
    }
    if (++nodes > nodeBudget) {
      proven = false;
      return;
    }
    const needed = open.length + Math.max(0, Math.ceil((remaining[i]! - free) / capacity));
    if (needed > best.count) return;

    const size = sizes[i]!;
    // Equal items are interchangeable: never place one before its twin's bin.
    const from = i > 0 && sizes[i - 1] === size ? assignment[i - 1]! : 0;
    const tried = new Set<number>();
    for (let bin = from; bin < open.length && proven; bin++) {
      const load = open[bin]!;
      if (load + size > capacity || tried.has(load)) continue;
      tried.add(load);
      open[bin] = load + size;
      free -= size;
      assignment[i] = bin;
      search(i + 1);
      open[bin] = load;
      free += size;
    }
    if (proven && open.length < best.count) {
      assignment[i] = open.push(size) - 1;
      free += capacity - size;
      search(i + 1);
      open.pop();
      free -= capacity - size;
    }
  };
  search(0);

  const bins: number[][] = Array.from({ length: best.count }, () => []);
  bestAssignment.forEach((bin, i) => bins[bin]!.push(i));
  return { bins, proven };
}
