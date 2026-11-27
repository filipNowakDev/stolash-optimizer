// PRD section 17.
import { describe, expect, it } from 'vitest';
import { FORMATEK_CSV, FORMATEK_TXT, toWindows1250 } from './fixtures';
import { calculate, calculateVersions } from './job';
import { canDouble } from './order';
import { decodeFile, parseRows, proposeMap, readTable, suggestGrainLock } from './parse';
import { FACTORY_SETTINGS } from './settings';
import type { Edge, Part, Settings } from './types';

// Section 17 describes short strips, which are off by default.
const OPTIMIZED: Settings = { ...FACTORY_SETTINGS, algorithm: 'optimized' };
const settings: Settings = { ...OPTIMIZED, shortStrips: true };
const PCV = { label: 'PCV 0,8 biały', thickness: 0.8 };

function part(length: number, edges: Edge[] = ['left'], extra: Partial<Part> = {}): Part {
  return {
    name: `p${length}`,
    material: 'Dąb',
    thickness: 18,
    length,
    width: 560,
    quantity: 1,
    edges: Object.fromEntries(edges.map((e) => [e, PCV])),
    ...extra,
  };
}

const run = (parts: Part[], grain: Record<string, boolean> = {}, doubled = {}) =>
  calculate(parts, settings, grain, doubled);

const load = (text: string) => {
  const table = readTable(text);
  const proposal = proposeMap(table, null);
  return { ...proposal, table, ...parseRows(table, proposal.map) };
};

describe('acceptance', () => {
  it('1: packs 2100, 720, 720, 564 into two full strips', () => {
    const { strips, rows } = run([part(2100), part(720, ['left'], { quantity: 2 }), part(564)]);
    expect(strips.map((s) => s.usedLength)).toEqual([2667.2, 1443.2]);
    expect(rows).toEqual([expect.objectContaining({ quantity: 2, length: 2760, width: 560 })]);
  });

  it('2: orders a single 800 piece short, at 810', () => {
    const [strip] = run([part(800)]).strips;
    expect(strip).toMatchObject({ orderLength: 810, offcut: 10, flags: ['short'] });
  });

  it('3: rejects a 2800 piece', () => {
    const result = run([part(2800)]);
    expect(result.strips).toEqual([]);
    expect(result.exceptions.map((e) => e.reason)).toEqual(['longerThanBoard']);
  });

  it('4: classifies by banded edges', () => {
    expect(run([part(720)]).strips[0]!.pieces[0]!.length).toBe(720);
    expect(run([part(720, ['left', 'right'])]).strips[0]).toMatchObject({
      stripWidth: 560,
      edgeL2: PCV.label,
    });
    expect(run([part(720, ['left', 'top'])]).exceptions[0]!.reason).toBe('adjacentEdges');
    expect(run([part(720, ['left', 'right', 'top'])]).exceptions[0]!.reason).toBe('finishedPart');
    const bare = run([part(720, [])]);
    expect(bare.unbanded).toMatchObject([{ length: 720 }]);
    expect(bare.strips).toMatchObject([{ stripWidth: 560, edgeL1: undefined }]);
  });

  it('5: bands across the grain on a strip limited to the board width', () => {
    const across = part(720, ['top']);
    const [locked] = run([across]).strips;
    expect(locked).toMatchObject({ crossCut: true, orderLength: 570, flags: ['short', 'acrossGrain'] });
    expect(locked!.pieces[0]!.length).toBe(560);

    // 1200 is full length: 2030 across the grain, 2760 once direction stops mattering.
    const long = part(720, ['top'], { width: 1200 });
    expect(run([long]).strips[0]).toMatchObject({ crossCut: true, orderLength: 2030 });
    expect(run([long], { Dąb: false }).strips[0]).toMatchObject({
      crossCut: false,
      orderLength: 2760,
      flags: [],
    });

    const tooLong = part(720, ['top'], { width: 2100 });
    expect(run([tooLong]).exceptions[0]!.reason).toBe('longerThanBoard');
    expect(run([tooLong], { Dąb: false }).strips).toHaveLength(1);
  });

  it('6: never mixes widths, materials, thicknesses or edge labels', () => {
    const parts = [
      part(500),
      part(500, ['left'], { width: 400 }),
      part(500, ['left'], { material: 'Buk' }),
      part(500, ['left'], { thickness: 25 }),
      part(500, ['left'], { edges: { left: { label: 'inne', thickness: 0.8 } } }),
    ];
    expect(run(parts).strips).toHaveLength(5);
  });

  it('7: reads the Windows-1250 Lista formatek CSV and TXT alike', () => {
    const decoded = decodeFile(toWindows1250(FORMATEK_CSV));
    expect(decoded.encoding).toBe('windows-1250');
    expect(decoded.text).toBe(FORMATEK_CSV);
    const csv = load(decoded.text);
    expect(csv.formatek).toBe(true);
    expect(csv.parts).toHaveLength(12);
    expect(load(FORMATEK_TXT).parts).toEqual(csv.parts);
  });

  it('7: skips a bad quantity and keeps the other rows', () => {
    const { parts, skipped } = load(FORMATEK_CSV.replace('"18";"5"', '"18";"0"'));
    expect(parts).toHaveLength(11);
    expect(skipped).toEqual([expect.objectContaining({ row: 2, reason: 'badQuantity' })]);
  });

  it('keeps unbanded and banded parts of one width on separate strips', () => {
    const { strips } = run([part(500, [], { name: '' }), part(500, ['left'])]);
    expect(strips.map((s) => [s.stripWidth, s.edgeL1])).toEqual([
      [560, undefined],
      [560, PCV.label],
    ]);
  });

  it('never offers to double a narrow unbanded strip', () => {
    const narrow = part(2000, [], { width: 50, quantity: 2 });
    const [strip] = run([narrow]).strips;
    expect(canDouble(strip!, settings)).toBe(false);
  });

  it('8: pairs narrow full strips and leaves the odd one single', () => {
    const narrow = part(2000, ['left'], { width: 50, quantity: 3 });
    const plain = run([narrow]);
    expect(plain.strips.every((s) => s.flags.includes('narrow'))).toBe(true);
    const { rows } = run([narrow], {}, { [plain.strips[0]!.groupKey]: true });
    expect(rows).toEqual([
      expect.objectContaining({ quantity: 1, width: 103.2, edgeL1: PCV.label, edgeL2: PCV.label }),
      expect.objectContaining({ quantity: 1, width: 50, edgeL2: undefined }),
    ]);
  });

  it('pairs wide one-edge strips too, to be ripped in half', () => {
    const wide = part(2000, ['left'], { quantity: 2 });
    const plain = run([wide]);
    const { rows } = run([wide], {}, { [plain.strips[0]!.groupKey]: true });
    expect(rows).toEqual([
      expect.objectContaining({ quantity: 1, width: 1123.2, edgeL1: PCV.label, edgeL2: PCV.label }),
    ]);
  });

  it('puts a width-banded part on an ordinary strip once its texture is rotated in PRO100', () => {
    // PRO100 then swaps the columns, so the band moves to the length.
    const { parts } = load('Part\t1024\t—\t600\t   \t18\t2\t');
    expect(run(parts).strips[0]).toMatchObject({
      crossCut: false,
      orderLength: 2760,
      stripWidth: 600,
      flags: [],
    });
  });

  it('fits a 290 part on a 300 strip when that orders less', () => {
    const wide = part(2000, [], { width: 300 });
    const narrow = part(500, [], { width: 290 });
    expect(run([wide, narrow]).strips).toMatchObject([
      { stripWidth: 300, orderLength: 2760, pieces: [{ width: 300 }, { width: 290 }] },
    ]);
    const off = calculate([wide, narrow], { ...settings, fitNarrower: false }, {}, {});
    expect(off.strips.map((s) => s.stripWidth)).toEqual([300, 290]);
  });

  it('joins similar widths when that shortens the wholesaler cuts', () => {
    // Two short strips would order less length, but need more cutting.
    const parts = [
      part(1024, ['left'], { width: 600 }),
      part(1024, ['left'], { width: 590 }),
    ];
    const joined = run(parts);
    expect(joined.strips).toMatchObject([
      { stripWidth: 600, orderLength: 2760, pieces: [{ width: 600 }, { width: 590 }] },
    ]);
    const apart = calculate(parts, { ...settings, fitNarrower: false }, {}, {});
    expect(apart.strips).toHaveLength(2);
    expect(joined.boards.length).toBeLessThanOrEqual(apart.boards.length);
    expect(joined.cutLength).toBeLessThan(apart.cutLength);
  });

  it('never narrows a part banded on both edges', () => {
    const { strips } = run([
      part(2000, ['left', 'right'], { width: 300 }),
      part(500, ['left', 'right'], { width: 290 }),
    ]);
    expect(strips).toHaveLength(2);
  });

  it('subtracts the banding only when asked to', () => {
    const subtract = { ...settings, subtractEdge: true };
    const both = part(720, ['left', 'right']);
    expect(calculate([both], subtract, {}, {}).strips[0]!.stripWidth).toBe(558.4);
    expect(run([both]).strips[0]!.stripWidth).toBe(560);
  });

  it('orders full-length strips by default', () => {
    const { strips } = calculate([part(800)], OPTIMIZED, {}, {});
    expect(strips).toMatchObject([{ orderLength: 2760, flags: [] }]);
  });

  it('offers different versions, the full-length best one first', () => {
    const { parts } = load(FORMATEK_CSV);
    const versions = calculateVersions(parts, OPTIMIZED, {}, {});
    expect(versions.length).toBeGreaterThan(1);
    expect(versions.length).toBeLessThanOrEqual(4);
    expect(versions[0]!.goals).toContain('cuts');
    const [first, ...others] = versions;
    for (const other of others) {
      if (!other.short) expect(other.metrics.boards).toBeGreaterThanOrEqual(first!.metrics.boards);
      expect(other.metrics).not.toEqual(first!.metrics);
    }
    // Every version cuts the same parts.
    const pieces = (v: (typeof versions)[number]) =>
      v.strips.flatMap((s) => s.pieces.map((p) => `${p.length}x${p.width}`)).sort();
    for (const other of others) expect(pieces(other)).toEqual(pieces(first!));
  });

  it('adds a short-strips version last, without changing the default', () => {
    const { parts } = load(FORMATEK_CSV);
    const versions = calculateVersions(parts, OPTIMIZED, {}, {});
    const short = versions.at(-1)!;
    expect(short.short).toBe(true);
    expect(short.strips.some((s) => s.flags.includes('short'))).toBe(true);
    expect(short.metrics.boards).toBeLessThan(versions[0]!.metrics.boards);
    expect(versions[0]!.strips.some((s) => s.flags.includes('short'))).toBe(false);

    const already = calculateVersions(parts, { ...OPTIMIZED, shortStrips: true }, {}, {});
    expect(already.some((v) => v.short)).toBe(false);
  });

  it('shares strips between length- and width-banded parts when grain does not matter', () => {
    const shelves = part(600, ['top'], { name: 'shelf', width: 436, quantity: 2 });
    const parts = [
      shelves,
      part(1720, ['left'], { width: 600 }),
      part(1024, ['left'], { width: 600 }),
      part(1024, ['left'], { width: 590 }),
    ];
    const { strips } = run(parts, { Dąb: false });
    expect(strips).toHaveLength(2);
    expect(strips.flatMap((s) => s.flags)).not.toContain('acrossGrain');
    // With grain kept the shelves need their own across-grain strip.
    expect(run(parts).strips.filter((s) => s.crossCut)).toHaveLength(1);
  });

  it('12: produces the expected result for the sample file', () => {
    const { parts } = load(FORMATEK_CSV);
    const grain = Object.fromEntries(parts.map((p) => [p.material, true]));
    const result = run(parts, grain);

    expect(
      result.rows.map((r) => [r.quantity, r.length, r.width, r.thickness, r.edgeL1]),
    ).toEqual([
      [1, 2760, 650, 18, undefined],
      [2, 2760, 282, 18, undefined],
      [4, 2030, 600, 18, null],
      [6, 2030, 590, 18, null],
      [4, 2760, 600, 18, null],
      [1, 25, 15, 1024, undefined],
      [1, 25, 15, 1264, undefined],
    ]);
    expect(result.rows.slice(2, 4).map((r) => r.flags)).toEqual([['acrossGrain'], ['acrossGrain']]);
    const reasons = result.exceptions.map((e) => [e.part.name.split(' ')[1], e.reason]);
    expect(reasons).toEqual([
      ['D', 'finishedPart'],
      ['D', 'finishedPart'],
    ]);
    expect(result.unbanded.map((p) => p.name)).toEqual(['', '', '', 'Przykład E', 'Przykład E']);
  });

  it('suggests grain from the material name', () => {
    expect(suggestGrainLock('Inne\\lustro srebrne')).toBe(false);
    expect(suggestGrainLock('Biały 18mm')).toBe(false);
    for (const name of ['Płyty\\biała gładka', 'białe', 'szara', 'czarne', 'jednolita', 'szkło']) {
      expect(suggestGrainLock(name), name).toBe(false);
    }
    expect(suggestGrainLock('Dąb Hikora')).toBe(true);
    expect(suggestGrainLock('')).toBe(true);
  });
});

describe('column mapping', () => {
  it('maps headers by synonym and reads edge products', () => {
    const { parts, map, formatek } = load(
      'Nazwa;Długość;Szerokość;Ilość;L;P\nBok;720,5;560;2;PCV 2,0 biały;brak\n',
    );
    expect(formatek).toBe(false);
    expect(map.mode).toBe('four');
    expect(parts[0]).toMatchObject({
      length: 720.5,
      quantity: 2,
      edges: { left: { label: 'PCV 2,0 biały', thickness: 2 } },
    });
  });

  it('skips unknown values in the one-column mode', () => {
    const { parts, skipped } = load('length,width,qty,edges\n720.5,560,1,L1L2\n700,500,1,???\n');
    expect(Object.keys(parts[0]!.edges)).toEqual(['left', 'right']);
    expect(skipped[0]!.reason).toBe('unknownEdge');
  });
});
