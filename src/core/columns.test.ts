// @vitest-environment node
import highsLoader from 'highs';
import { beforeAll, describe, expect, it } from 'vitest';
import { classify } from './classify';
import { packColumns, type Solver } from './columns';
import { FORMATEK_CSV } from './fixtures';
import { calculateVersions } from './job';
import { pack } from './pack';
import { parseRows, proposeMap, readTable } from './parse';
import { FACTORY_SETTINGS } from './settings';
import type { Candidate, Part, Settings, Strip } from './types';

const settings: Settings = { ...FACTORY_SETTINGS, algorithm: 'highs' };
let solver: Solver;
beforeAll(async () => {
  solver = (await highsLoader()) as unknown as Solver;
});

const part = (length: number, width: number, quantity = 1): Part => ({
  name: `${length}x${width}`,
  material: 'M',
  thickness: 18,
  length,
  width,
  quantity,
  edges: { left: { label: 'e', thickness: 1 } },
});
const candidates = (parts: Part[]): Candidate[] => classify(parts, settings, {}).candidates;
const area = (strips: Strip[]) => strips.reduce((a, s) => a + s.stripWidth * s.orderLength, 0);
const pieces = (strips: Strip[]) =>
  strips.flatMap((s) => s.pieces.map((p) => `${p.length}x${p.width}`)).sort();

describe('packColumns', () => {
  it('mixes widths better than filling width by width', () => {
    // Two 600 strips hold everything when the 590 parts ride along.
    const input = candidates([part(1800, 600, 2), part(900, 590, 2)]);
    const result = packColumns(input, settings, solver);
    expect(result.strips.map((s) => s.stripWidth)).toEqual([600, 600]);
    expect(result.areaBound).toBeLessThanOrEqual(area(result.strips) + 1);
    expect(result.areaBound).toBeGreaterThan(0);
  });

  it('places every part once, fits strips, and never beats its own bound', () => {
    let seed = 7;
    const random = (n: number) => (seed = (seed * 48271) % 2147483647) % n;
    for (let run = 0; run < 15; run++) {
      const input = candidates(
        Array.from({ length: 3 + random(8) }, () =>
          part(200 + random(2400), [300, 400, 590, 600][random(4)]!, 1 + random(4)),
        ),
      );
      const result = packColumns(input, settings, solver);
      expect(pieces(result.strips)).toEqual(pieces(pack(input, settings).strips));
      for (const strip of result.strips) {
        expect(strip.pieces.every((p) => p.width <= strip.stripWidth)).toBe(true);
        expect(strip.usedLength).toBeLessThanOrEqual(2760);
      }
      expect(area(result.strips)).toBeGreaterThanOrEqual(result.areaBound! - 1);
    }
  });

  it('keeps parts banded on both edges on strips of their own width', () => {
    const both = (width: number): Part => ({
      ...part(500, width),
      edges: { left: { label: 'e', thickness: 1 }, right: { label: 'e', thickness: 1 } },
    });
    const result = packColumns(candidates([both(300), both(290)]), settings, solver);
    expect(result.strips.map((s) => s.stripWidth).sort()).toEqual([290, 300]);
  });

  it('is never worse than the optimizer on boards, then cuts', () => {
    let seed = 11;
    const random = (n: number) => (seed = (seed * 48271) % 2147483647) % n;
    for (let run = 0; run < 6; run++) {
      const parts = Array.from({ length: 6 + random(10) }, () =>
        part(250 + random(1800), [300, 400, 590, 600][random(4)]!, 1 + random(4)),
      );
      const score = (algorithm: 'highs' | 'optimized') => {
        const [v] = calculateVersions(parts, { ...settings, algorithm }, {}, {}, solver);
        return [v!.metrics.boards, v!.cutLength] as const;
      };
      const [boards, cuts] = score('highs');
      const [plainBoards, plainCuts] = score('optimized');
      expect(boards < plainBoards || (boards === plainBoards && cuts <= plainCuts)).toBe(true);
    }
  });

  it('runs through the whole calculation on the sample file', () => {
    const table = readTable(FORMATEK_CSV);
    const { parts } = parseRows(table, proposeMap(table, null).map);
    const [first] = calculateVersions(parts, settings, {}, {}, solver);
    const plain = calculateVersions(parts, { ...settings, algorithm: 'optimized' }, {}, {})[0]!;
    expect(pieces(first!.strips)).toEqual(pieces(plain.strips));
    expect(first!.areaBound).toBeLessThanOrEqual(area(first!.strips) + 1);
  });
});
