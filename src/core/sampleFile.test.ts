// @vitest-environment node
// An anonymized PRO100 v5 export, bytes as saved: Windows-1250, CRLF, no header.
import { readFileSync } from 'node:fs';
import highsLoader from 'highs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Solver } from './columns';
import { calculateVersions } from './job';
import { decodeFile, parseRows, proposeMap, readTable, suggestGrainLock } from './parse';
import { FACTORY_SETTINGS } from './settings';
import type { Algorithm, Part } from './types';

const bytes = readFileSync(new URL('./testdata/lista-formatek.csv', import.meta.url));
const { text, encoding } = decodeFile(new Uint8Array(bytes).buffer);
const table = readTable(text);
const proposal = proposeMap(table, null);
const { parts, skipped } = parseRows(table, proposal.map);
const grain = Object.fromEntries(parts.map((p) => [p.material, suggestGrainLock(p.material)]));

let solver: Solver;
beforeAll(async () => {
  solver = (await highsLoader()) as unknown as Solver;
});

const run = (algorithm: Algorithm) =>
  calculateVersions(parts, { ...FACTORY_SETTINGS, algorithm }, grain, {}, solver)[0]!;
const total = (list: Part[]) => list.reduce((sum, p) => sum + p.quantity, 0);

describe('exported sample file', () => {
  it('is read as a Lista formatek without skipping a row', () => {
    expect(encoding).toBe('windows-1250');
    expect(proposal.formatek).toBe(true);
    expect(parts).toHaveLength(26);
    expect(skipped).toEqual([]);
    expect(parts[0]).toMatchObject({ name: 'Przykład 01', material: 'Płyty\\Dekor gładki 1' });
    expect(Object.values(grain)).toEqual([false, false]);
  });

  it.each(['ffd', 'optimized', 'highs'] as const)(
    'with %s orders doors whole and cuts every other part from a strip',
    (algorithm) => {
      const result = run(algorithm);
      const whole = result.exceptions.map((e) => e.part);
      expect(result.exceptions.every((e) => e.reason === 'finishedPart')).toBe(true);
      expect(total(whole)).toBe(5);
      expect(result.strips.reduce((sum, s) => sum + s.pieces.length, 0)).toBe(total(parts) - 5);
    },
  );

  it('saves a board with HiGHS on this job', () => {
    expect(run('highs').metrics.boards).toBe(6);
    expect(run('optimized').metrics.boards).toBe(7);
    expect(run('ffd').metrics.boards).toBe(7);
  });
});
