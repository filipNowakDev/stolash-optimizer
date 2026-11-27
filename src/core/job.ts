// The whole calculation from parsed parts to result lists. Pure.
import { boardStats, layoutBoards, layoutChoices, type Board } from './boards';
import { classify } from './classify';
import { packColumns, type Solver } from './columns';
import { mergeStrips, type Score } from './fill';
import { applyDoubling, collapseExceptions, collapseParts, orderRows } from './order';
import { pack } from './pack';
import type { Part, Settings, Strip } from './types';

export const GOALS = ['cuts', 'offcuts', 'work'] as const;
export type Goal = (typeof GOALS)[number];

const VERSIONS = 3;

export interface Metrics {
  boards: number;
  /** Wholesaler cuts, mm. */
  cutLength: number;
  /** The shop's cuts, mm. */
  ownLength: number;
  /** Board area not ending up in a part, mm². */
  waste: number;
  /** Area of leftovers with both sides at least minOffcut, mm². */
  reusable: number;
  /** Sum of squared leftover areas: higher means fewer, larger pieces. */
  chunks: number;
  largest: { dx: number; dy: number } | null;
}

function measureBoards(strips: Strip[], boards: Board[], settings: Settings): Metrics {
  const parts = strips.reduce(
    (sum, s) => sum + s.pieces.reduce((a, p) => a + p.length * p.width, 0),
    0,
  );
  const metrics: Metrics = {
    boards: boards.length,
    cutLength: 0,
    ownLength: 0,
    waste: boards.length * settings.maxLength * settings.maxWidth - parts,
    reusable: 0,
    chunks: 0,
    largest: null,
  };
  for (const board of boards) {
    const stats = boardStats(board, strips, settings);
    metrics.cutLength += board.cutLength;
    metrics.ownLength += stats.ownLength;
    for (const { dx, dy } of stats.offcuts) {
      if (Math.min(dx, dy) < settings.minOffcut) continue;
      metrics.reusable += dx * dy;
      metrics.chunks += ((dx * dy) / 1e6) ** 2;
      if (!metrics.largest || dx * dy > metrics.largest.dx * metrics.largest.dy) {
        metrics.largest = { dx, dy };
      }
    }
  }
  return metrics;
}

/** What each goal compares, most important first; lower is better. Boards always lead. */
const RANK: Record<Goal, (m: Metrics) => number[]> = {
  cuts: (m) => [m.boards, m.cutLength, m.ownLength, -m.reusable],
  offcuts: (m) => [m.boards, -m.chunks, -m.reusable, m.cutLength],
  work: (m) => [m.boards, m.ownLength, m.cutLength, -m.reusable],
};

const compare = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i]! - b[i]!) > 1e-6) return a[i]! - b[i]!;
  }
  return 0;
};

/** Every layout tried under these settings. */
function layouts(
  classified: ReturnType<typeof classify>,
  settings: Settings,
  doubled: Record<string, boolean>,
  solver: Solver | undefined,
) {
  const { algorithm } = settings;
  // Ways to fill the strips. Earlier ones win ties: they order less.
  const plain = pack(
    classified.candidates,
    { ...settings, fitNarrower: false },
    algorithm === 'ffd' ? 0 : undefined,
  );
  let plans = [{ proven: plain.proven, strips: plain.strips }];
  let areaBound: number | null = null;
  if (algorithm !== 'ffd' && settings.fitNarrower) {
    const fitted = pack(classified.candidates, settings);
    const rate = (stock: Strip[]): Score => {
      // No random restarts: this runs once for every merge tried.
      const boards = layoutBoards(applyDoubling(stock, settings, doubled), settings, 0);
      return [boards.length, boards.reduce((sum, board) => sum + board.cutLength, 0)];
    };
    plans.unshift(
      { proven: fitted.proven, strips: mergeStrips(fitted.strips, settings, rate) },
      { proven: fitted.proven, strips: fitted.strips },
    );
  }

  // HiGHS orders the least strip area, which is not the goal itself, so its plan
  // competes with the others. First, so it wins ties.
  if (algorithm === 'highs') {
    if (!solver) throw new Error('The HiGHS algorithm needs a loaded solver');
    const columns = packColumns(classified.candidates, settings, solver);
    plans.unshift({ proven: false, strips: columns.strips });
    areaBound = columns.areaBound;
  }

  const candidates = plans.flatMap((plan) => {
    const strips = applyDoubling(plan.strips, settings, doubled);
    return layoutChoices(strips, settings).map((boards) => ({
      proven: plan.proven,
      strips,
      boards,
      metrics: measureBoards(strips, boards, settings),
    }));
  });
  // Parts too long for any board; the same however the strips are filled.
  return { candidates, exceptions: plain.exceptions, areaBound };
}

/**
 * Different ways to cut the job: up to three with the strip lengths as set, the
 * first being the best for fewest boards and wholesaler cuts, and then one with
 * every part-filled strip ordered short. `goals` says what a version is best at
 * among the layouts with the set lengths; it is empty for an alternative.
 */
export function calculateVersions(
  parts: Part[],
  settings: Settings,
  grainLock: Record<string, boolean>,
  doubled: Record<string, boolean>,
  /** Needed for the 'highs' algorithm only. */
  solver?: Solver,
) {
  const classified = classify(parts, settings, grainLock);
  const { candidates, exceptions, areaBound } = layouts(classified, settings, doubled, solver);

  type Candidate = (typeof candidates)[number];
  // Figures that would read the same in the table count as the same version.
  const shown = ({ metrics: m }: Candidate) =>
    [m.cutLength / 100, m.ownLength / 100, m.reusable / 1e5, m.chunks * 10]
      .map(Math.round)
      .concat(m.boards)
      .join();
  const same = (a: Candidate, b: Candidate) => shown(a) === shown(b);
  const chosen: { candidate: Candidate; goals: Goal[]; short: boolean }[] = [];
  const ranked = (goal: Goal, from = candidates) =>
    [...from].sort((a, b) => compare(RANK[goal](a.metrics), RANK[goal](b.metrics)));
  for (const goal of GOALS) {
    const best = ranked(goal)[0]!;
    const listed = chosen.find((c) => same(c.candidate, best));
    if (listed) listed.goals.push(goal);
    else chosen.push({ candidate: best, goals: [goal], short: false });
  }
  // Fill up with other layouts: fewest boards first, then ones not beaten on
  // every count by another.
  const beaten = ({ metrics: a }: Candidate) =>
    candidates.some(
      ({ metrics: b }) =>
        b.boards <= a.boards &&
        b.cutLength < a.cutLength &&
        b.ownLength <= a.ownLength &&
        b.chunks > a.chunks,
    );
  const others = ranked('cuts').sort(
    (a, b) => a.metrics.boards - b.metrics.boards || Number(beaten(a)) - Number(beaten(b)),
  );
  for (const candidate of others) {
    if (chosen.length >= VERSIONS) break;
    if (!chosen.some((c) => same(c.candidate, candidate))) {
      chosen.push({ candidate, goals: [], short: false });
    }
  }

  // Offered last, so it never becomes the default.
  if (!settings.shortStrips) {
    const shortened = { ...settings, shortStrips: true, shortStripRatio: 1 };
    const best = ranked('cuts', layouts(classified, shortened, doubled, solver).candidates)[0]!;
    if (!chosen.some((c) => same(c.candidate, best))) {
      chosen.push({ candidate: best, goals: [], short: true });
    }
  }

  const lists = (candidate: Candidate) => ({
    rows: orderRows(candidate.strips, settings),
    exceptions: collapseExceptions([...classified.exceptions, ...exceptions]),
    unbanded: collapseParts(classified.unbanded),
  });
  return chosen.map(({ candidate, goals, short }, i) => ({
    id: short ? 'short' : goals.length > 0 ? goals.join('+') : `other${i}`,
    number: i + 1,
    goals,
    short,
    ...candidate,
    ...lists(candidate),
    /** Least strip area any packing could order, mm²; only HiGHS gives one. */
    areaBound: short ? null : areaBound,
    /** mm of wholesaler cuts over all boards. */
    cutLength: candidate.metrics.cutLength,
  }));
}

/** The default version. */
export const calculate = (...args: Parameters<typeof calculateVersions>) =>
  calculateVersions(...args)[0]!;

export type Result = ReturnType<typeof calculate>;
