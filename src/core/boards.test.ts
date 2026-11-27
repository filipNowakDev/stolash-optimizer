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
  crossCut = false,
): Strip {
  return {
    groupKey: `${material}-${stripWidth}`,
    material,
    thickness: 18,
    edgeL1: null,
    edgeL2: undefined,
    stripWidth,
    crossCut,
    orderLength,
    pieces: [],
    usedLength: orderLength,
    offcut: 0,
    flags,
  };
}

/** Every strip placed once, unrotated, inside its board, a kerf apart from the others. */
function expectValid(boards: Board[], strips: Strip[]) {
  const placed = boards.flatMap((b) => b.blanks.flatMap((blank) => blank.strips));
  expect(placed.sort((a, b) => a - b)).toEqual(strips.map((_, i) => i));
  const gap = settings.sawKerf - 1e-6;
  for (const { blanks } of boards) {
    blanks.forEach((a, i) => {
      const first = strips[a.strips[0]!]!;
      expect(a.turned).toBe(first.crossCut);
      expect([a.dx, a.dy]).toEqual(a.turned ? [a.width, a.length] : [a.length, a.width]);
      expect(a.x + a.dx).toBeLessThanOrEqual(settings.maxLength + 1e-6);
      expect(a.y + a.dy).toBeLessThanOrEqual(settings.maxWidth + 1e-6);
      for (const b of blanks.slice(i + 1)) {
        const apart =
          a.x + a.dx + gap <= b.x ||
          b.x + b.dx + gap <= a.x ||
          a.y + a.dy + gap <= b.y ||
          b.y + b.dy + gap <= a.y;
        expect(apart).toBe(true);
      }
    });
  }
}

describe('layoutBoards', () => {
  it('rips strips side by side, with the cuts it needs', () => {
    // 3 × 600 + 2 × 3.2 = 1806.4 fits 2030; a fourth does not.
    const strips = Array.from({ length: 4 }, () => strip(600));
    const boards = layoutBoards(strips, settings);
    expect(boards.map((b) => b.blanks.length)).toEqual([3, 1]);
    // One full-length rip under each strip, none of them needing a crosscut.
    expect(boards.map((b) => [b.cuts, b.cutLength])).toEqual([
      [3, 8280],
      [1, 2760],
    ]);
    expectValid(boards, strips);
  });

  it('fills the space beside a short wide strip with narrower ones', () => {
    // As lanes these need 1024 + 600 + 3 × 300 = 2524 of width: two boards.
    const strips = [strip(1024, 600), strip(600), strip(300, 624), strip(300, 624), strip(300, 624)];
    const boards = layoutBoards(strips, settings);
    expect(boards).toHaveLength(1);
    expectValid(boards, strips);
  });

  it('mixes along- and across-grain strips on one board without rotating them', () => {
    const strips = [strip(600, 2030, 'Dąb', [], true), strip(600, 2000), strip(600, 2000)];
    const boards = layoutBoards(strips, settings);
    expect(boards).toHaveLength(1);
    expectValid(boards, strips);
  });

  it('keeps materials on separate boards', () => {
    const boards = layoutBoards([strip(300), strip(300, 2760, 'Buk')], settings);
    expect(boards.map((b) => b.material)).toEqual(['Dąb', 'Buk']);
  });

  it('keeps a doubled pair in one blank', () => {
    const strips = [strip(50, 2760, 'Dąb', ['doubled']), strip(50, 2760, 'Dąb', ['doubled'])];
    const [board] = layoutBoards(strips, settings);
    expect(board!.blanks).toMatchObject([{ strips: [0, 1], width: 103.2 }]);
  });

  it('stays valid, deterministic and close to the area bound on a mixed job', () => {
    const strips = Array.from({ length: 40 }, (_, i) =>
      strip(50 + ((i * 137) % 900), 300 + ((i * 331) % 2460), 'Dąb', [], i % 5 === 0 && i % 2 === 0),
    ).map((s) => (s.crossCut ? { ...s, orderLength: Math.min(s.orderLength, 2030) } : s));
    const boards = layoutBoards(strips, settings);
    expectValid(boards, strips);
    expect(layoutBoards(strips, settings)).toEqual(boards);
    const area = strips.reduce((sum, s) => sum + s.stripWidth * s.orderLength, 0);
    const bound = Math.ceil(area / (settings.maxLength * settings.maxWidth));
    expect(boards.length).toBeLessThanOrEqual(Math.ceil(bound * 1.3));
  });
});

describe('boardStats', () => {
  it('counts the shop cuts, waste and leftovers', () => {
    const strips = [{ ...strip(1000), pieces: [{ name: 'a', length: 1380, width: 1000 }] }];
    const [board] = layoutBoards(strips, settings);
    expect([board!.cuts, board!.cutLength]).toEqual([1, 2760]);
    const stats = boardStats(board!, strips, settings);
    expect([stats.own, stats.ownLength]).toEqual([1, 1000]);
    expect(stats.wastePercent).toBeCloseTo(100 - (1380 * 1000 * 100) / (2760 * 2030));
    expect(stats.offcuts).toEqual([
      { x: 0, y: 1003.2, dx: 2760, dy: 1026.8 },
      { x: 1383.2, y: 0, dx: 1376.8, dy: 1000 },
    ]);
  });
});
