import { describe, expect, it } from 'vitest';
import { boardStats, layoutBoards, type Board } from './boards';
import { FACTORY_SETTINGS } from './settings';
import type { Strip, StripFlag } from './types';

const settings = { ...FACTORY_SETTINGS };

function strip(
  stripWidth: number,
  orderLength = 2760,
  material = 'Dąb',
  flags: StripFlag[] = [],
): Strip {
  return {
    groupKey: `${material}-${stripWidth}`,
    material,
    thickness: 18,
    edgeL1: null,
    edgeL2: undefined,
    crossCut: false,
    stripWidth,
    orderLength,
    pieces: [],
    usedLength: orderLength,
    offcut: 0,
    flags,
  };
}

/** Every strip placed once, inside its board, with at least a kerf between neighbors. */
function expectValid(boards: Board[], count: number) {
  const placed = boards.flatMap((b) => b.strips.map((s) => s.strip));
  expect(placed.sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, i) => i));
  const gap = settings.sawKerf - 1e-6;
  for (const { strips } of boards) {
    strips.forEach((a, i) => {
      expect(a.x + a.length).toBeLessThanOrEqual(settings.maxLength + 1e-6);
      expect(a.y + a.width).toBeLessThanOrEqual(settings.maxWidth + 1e-6);
      for (const b of strips.slice(i + 1)) {
        const apart =
          a.x + a.length + gap <= b.x ||
          b.x + b.length + gap <= a.x ||
          a.y + a.width + gap <= b.y ||
          b.y + b.width + gap <= a.y;
        expect(apart).toBe(true);
      }
    });
  }
}

describe('boardStats', () => {
  it('counts cuts, waste and leftovers', () => {
    const strips = [{ ...strip(1000), pieces: [{ name: 'a', length: 1380 }] }];
    const [board] = layoutBoards(strips, settings);
    const stats = boardStats(board!, strips, settings);
    // One rip along the board, one crosscut after the piece.
    expect([stats.cuts, stats.cutLength]).toEqual([2, 3760]);
    expect(stats.wastePercent).toBeCloseTo(100 - (1380 * 1000 * 100) / (2760 * 2030));
    expect(stats.offcuts).toEqual([
      { x: 1383.2, y: 0, length: 1376.8, width: 1000 },
      { x: 0, y: 1003.2, length: 2760, width: 1026.8 },
    ]);
  });
});

describe('layoutBoards', () => {
  it('rips strips side by side with a kerf between them', () => {
    // 3 × 600 + 2 × 3.2 = 1806.4 fits 2030; a fourth does not.
    const strips = Array.from({ length: 4 }, () => strip(600));
    const boards = layoutBoards(strips, settings);
    expect(boards.map((b) => b.strips.length)).toEqual([3, 1]);
    expectValid(boards, 4);
  });

  it('puts short strips of one width end to end', () => {
    const strips = [strip(600, 1000), strip(600, 1000), strip(600, 700)];
    const [board, ...rest] = layoutBoards(strips, settings);
    expect(rest).toEqual([]);
    expect(board!.strips.map((s) => [s.x, s.y])).toEqual([
      [0, 0],
      [1003.2, 0],
      [2006.4, 0],
    ]);
  });

  it('keeps materials on separate boards', () => {
    const boards = layoutBoards([strip(300), strip(300, 2760, 'Buk')], settings);
    expect(boards.map((b) => b.material)).toEqual(['Dąb', 'Buk']);
  });

  it('puts across-grain strips on turned boards of their own', () => {
    const across = { ...strip(600, 2030), crossCut: true };
    const boards = layoutBoards([across, across, strip(600)], settings);
    expect(boards.map((b) => [b.crossCut, b.strips.length])).toEqual([
      [true, 2],
      [false, 1],
    ]);
    // Side by side along the 2760 side, each 2030 long.
    expect(boards[0]!.strips.map((s) => [s.y, s.length])).toEqual([
      [0, 2030],
      [603.2, 2030],
    ]);
  });

  it('keeps a doubled pair together', () => {
    const strips = [strip(50, 2760, 'Dąb', ['doubled']), strip(50, 2760, 'Dąb', ['doubled'])];
    const [board] = layoutBoards(strips, settings);
    expect(board!.strips.map((s) => s.y)).toEqual([0, 53.2]);
    expectValid([board!], 2);
  });

  it('stays valid for a mixed job', () => {
    const strips = Array.from({ length: 40 }, (_, i) =>
      strip(50 + ((i * 137) % 900), 300 + ((i * 331) % 2460)),
    );
    expectValid(layoutBoards(strips, settings), 40);
  });
});
