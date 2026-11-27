// Experimental strip packing by column generation (Gilmore and Gomory). Pure.
//
// A "pattern" is one strip of some width with so many of each part on it; a part
// may sit on a wider strip and be ripped. The solver picks patterns that cover
// every part with the least total strip width, which for full-length strips is
// the least ordered area. All parts of compatible widths are decided together.
import { measure } from './fill';
import { groupKey, pack, type PackResult } from './pack';
import { boardSize } from './settings';
import type { Candidate, Settings, Strip, StripFlag } from './types';

/** The part of HiGHS used here, so the core does not depend on the library. */
export interface Solver {
  solve(
    model: string,
    options?: Record<string, number | string | boolean>,
  ): {
    Status: string;
    Columns: Record<string, unknown>;
    Rows: unknown[];
  };
}

interface Item {
  candidate: Candidate;
  /** Integer micrometers, including one kerf. */
  size: number;
  width: number;
  demand: number;
  names: string[];
}

interface Pattern {
  width: number;
  counts: number[];
}

export interface ColumnResult extends PackResult {
  /**
   * No set of strips can order less area than this, mm². null when the search
   * stopped early or short strips are on, so no bound holds.
   */
  areaBound: number | null;
}

const um = (mm: number) => Math.round(mm * 1000);
const MAX_ROUNDS = 300;
const KNAPSACK_BUDGET = 100_000;

/** Strips can share parts: same everything, and width too unless the shop may rip. */
function familyKey(c: Candidate, settings: Settings): string {
  const key = JSON.parse(groupKey(c)) as unknown[];
  if (settings.fitNarrower && c.edgeL2 === undefined) key.splice(4, 1);
  return JSON.stringify(key);
}

/** The most valuable set of items for one strip, by depth-first branch and bound. */
function knapsack(items: Item[], values: number[], allowed: number[], capacity: number) {
  const order = allowed
    .filter((i) => values[i]! > 1e-9)
    .sort((a, b) => values[b]! / items[b]!.size - values[a]! / items[a]!.size);
  const counts = new Array<number>(items.length).fill(0);
  let best = { value: 0, counts: counts.slice() };
  let nodes = 0;
  let complete = true;

  const search = (at: number, room: number, value: number) => {
    if (value > best.value + 1e-9) best = { value, counts: counts.slice() };
    if (at === order.length) return;
    if (++nodes > KNAPSACK_BUDGET) {
      complete = false;
      return;
    }
    const i = order[at]!;
    const { size, demand } = items[i]!;
    // Filling the rest with the best remaining ratio cannot be beaten.
    if (value + (room * values[i]!) / size <= best.value + 1e-9) return;
    for (let n = Math.min(demand, Math.floor(room / size)); n >= 0 && complete; n--) {
      counts[i] = n;
      search(at + 1, room - n * size, value + n * values[i]!);
    }
    counts[i] = 0;
  };
  search(0, capacity, 0);
  return { ...best, complete };
}

/** CPLEX LP text: minimize strip widths, covering every demand. */
function model(items: Item[], patterns: Pattern[], integer: boolean): string {
  // Short lines: the reader limits line length.
  const wrap = (terms: string[]) => terms.join('\n ');
  const rows = items.map((item, i) => {
    const terms = patterns.flatMap((p, j) => (p.counts[i]! > 0 ? [`+ ${p.counts[i]} x${j}`] : []));
    return `c${i}: ${wrap(terms)}\n >= ${item.demand}`;
  });
  return [
    'Minimize',
    `obj: ${wrap(patterns.map((p, j) => `+ ${p.width} x${j}`))}`,
    'Subject To',
    ...rows,
    ...(integer ? ['General', wrap(patterns.map((_, j) => `x${j}`))] : []),
    'End',
  ].join('\n');
}

const primal = (solution: ReturnType<Solver['solve']>, j: number) =>
  (solution.Columns[`x${j}`] as { Primal?: number } | undefined)?.Primal ?? 0;

function solveFamily(items: Item[], capacity: number, solver: Solver) {
  const widths = [...new Set(items.map((i) => i.width))].sort((a, b) => b - a);
  // Start: each item alone, as often as it fits on a strip of its own width.
  const patterns: Pattern[] = items.map((item, i) => ({
    width: item.width,
    counts: items.map((_, k) =>
      k === i ? Math.min(item.demand, Math.floor(capacity / item.size)) : 0,
    ),
  }));
  const seen = new Set(patterns.map((p) => `${p.width}:${p.counts}`));

  let bound: number | null = null;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const relaxed = solver.solve(model(items, patterns, false));
    if (relaxed.Status !== 'Optimal') break;
    const prices = items.map((_, i) => (relaxed.Rows[i] as { Dual?: number }).Dual ?? 0);

    let added = false;
    let complete = true;
    for (const width of widths) {
      const allowed = items.flatMap((item, i) => (item.width <= width ? [i] : []));
      const best = knapsack(items, prices, allowed, capacity);
      complete &&= best.complete;
      const key = `${width}:${best.counts}`;
      // Worth adding when its parts are valued above what the strip costs.
      if (best.value > width + 1e-6 && !seen.has(key)) {
        seen.add(key);
        patterns.push({ width, counts: best.counts });
        added = true;
      }
    }
    if (!added) {
      if (complete) bound = patterns.reduce((sum, p, j) => sum + p.width * primal(relaxed, j), 0);
      break;
    }
  }

  // Whole strips, chosen from the patterns found. A node limit keeps it repeatable.
  const whole = solver.solve(model(items, patterns, true), { mip_max_nodes: 2000 });
  const uses = patterns.map((_, j) => Math.round(primal(whole, j)));
  const covered = items.every(
    (item, i) => patterns.reduce((sum, p, j) => sum + p.counts[i]! * uses[j]!, 0) >= item.demand,
  );
  return { patterns, uses, covered, bound };
}

export function packColumns(
  candidates: Candidate[],
  settings: Settings,
  solver: Solver,
): ColumnResult {
  const usable = (c: Candidate) =>
    um(boardSize(settings, c.crossCut).length - settings.trimAllowance);
  // Parts too long to share a strip are handled as in the ordinary packing.
  const alone = candidates.filter((c) => um(c.pieceLength) > usable(c));
  const rest = candidates.filter((c) => um(c.pieceLength) <= usable(c));
  const base = pack(alone, { ...settings, fitNarrower: false });
  const result: ColumnResult = {
    strips: [...base.strips],
    exceptions: base.exceptions,
    proven: false,
    // The lone full-length strips are unavoidable, so they count towards the bound.
    areaBound: base.strips.reduce((sum, s) => sum + s.stripWidth * s.orderLength, 0),
  };

  const families = new Map<string, Candidate[]>();
  for (const c of rest) {
    const key = familyKey(c, settings);
    families.set(key, [...(families.get(key) ?? []), c]);
  }

  for (const family of families.values()) {
    const head = family[0]!;
    const boardLength = boardSize(settings, head.crossCut).length;
    const byShape = new Map<string, Item>();
    for (const c of family) {
      const shape = `${c.pieceLength}x${c.boardWidth}`;
      const item = byShape.get(shape) ?? {
        candidate: c,
        size: um(c.pieceLength) + um(settings.sawKerf),
        width: c.boardWidth,
        demand: 0,
        names: [],
      };
      item.demand += c.part.quantity;
      item.names.push(...new Array<string>(c.part.quantity).fill(c.part.name));
      byShape.set(shape, item);
    }
    const items = [...byShape.values()];
    const capacity = usable(head) + um(settings.sawKerf);
    const { patterns, uses, covered, bound } = solveFamily(items, capacity, solver);

    if (!covered) {
      // The solver gave no usable answer: fall back rather than lose parts.
      const plain = pack(family, settings);
      result.strips.push(...plain.strips);
      result.areaBound = null;
      continue;
    }
    result.areaBound =
      bound === null || result.areaBound === null || settings.shortStrips
        ? null
        : result.areaBound + bound * boardLength;

    const waiting = items.map((item) => item.names.slice());
    patterns.forEach((pattern, j) => {
      for (let n = 0; n < uses[j]!; n++) {
        // Patterns may cover more than is needed; surplus places stay empty.
        const pieces = pattern.counts.flatMap((count, i) =>
          waiting[i]!.splice(0, count).map((name) => ({
            name,
            length: items[i]!.candidate.pieceLength,
            width: items[i]!.width,
          })),
        );
        if (pieces.length === 0) continue;
        pieces.sort((a, b) => b.width - a.width || b.length - a.length);
        const width = pieces[0]!.width;
        const widest = items.find((item) => item.width === width)!.candidate;
        const { short, usedLength, orderLength, offcut } = measure(pieces, head.crossCut, settings);
        const flags: StripFlag[] = [];
        if (short) flags.push('short');
        if (width < settings.minStripWidth) flags.push('narrow');
        if (head.crossCut) flags.push('acrossGrain');
        const strip: Strip = {
          groupKey: groupKey(widest),
          material: head.part.material,
          thickness: head.part.thickness,
          edgeL1: head.edgeL1,
          edgeL2: head.edgeL2,
          stripWidth: width,
          crossCut: head.crossCut,
          orderLength,
          pieces,
          usedLength,
          offcut,
          flags,
        };
        result.strips.push(strip);
      }
    });
  }

  return result;
}
