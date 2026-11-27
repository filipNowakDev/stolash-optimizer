import { describe, expect, it } from 'vitest';
import { banding } from './banding';
import { FORMATEK_CSV } from './fixtures';
import { calculate } from './job';
import { parseRows, proposeMap, readTable } from './parse';
import { FACTORY_SETTINGS } from './settings';
import type { Settings } from './types';

const settings: Settings = { ...FACTORY_SETTINGS, algorithm: 'optimized' };
const table = readTable(FORMATEK_CSV);
const { parts } = parseRows(table, proposeMap(table, null).map);

describe('banding', () => {
  it('adds up ordered strips and whole elements', () => {
    const result = calculate(parts, settings, {}, {});
    const [only, ...others] = result.banding;
    expect(others).toEqual([]);
    // Four doors-worth of full perimeters: 2 × (2 × 2388 + 2 × 528) + the same at 648.
    expect(only!.whole).toBe(2 * 2 * (2388 + 528) + 2 * 2 * (2388 + 648));
    // Every banded strip has one side banded along its order length.
    const strips = result.strips.filter((s) => s.edgeL1 !== undefined);
    expect(only!.strips).toBe(strips.reduce((sum, s) => sum + s.orderLength, 0));
    expect(result.metrics.banding).toBe(only!.strips + only!.whole);
  });

  it('counts both sides of a strip and keeps products apart', () => {
    const strip = { edgeL1: 'A', edgeL2: 'A', orderLength: 2760 };
    const other = { edgeL1: 'B', edgeL2: undefined, orderLength: 1000 };
    expect(banding([strip, other] as never, [], settings)).toEqual([
      { label: 'A', strips: 5520, whole: 0 },
      { label: 'B', strips: 1000, whole: 0 },
    ]);
  });
});
