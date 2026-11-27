// PRD section 17.
import { describe, expect, it } from 'vitest';
import { FORMATEK_CSV, FORMATEK_TXT, toWindows1250 } from './fixtures';
import { calculate } from './job';
import { canDouble } from './order';
import { decodeFile, parseRows, proposeMap, readTable, suggestGrainLock } from './parse';
import { FACTORY_SETTINGS } from './settings';
import type { Edge, Part, Settings } from './types';

const settings: Settings = { ...FACTORY_SETTINGS };
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
    expect(rows).toEqual([expect.objectContaining({ quantity: 2, length: 2760, width: 559.2 })]);
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
      stripWidth: 558.4,
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
    // 560.8 banded orders at 560, the same width as the bare part.
    const { strips } = run([part(500, [], { name: '' }), part(500, ['left'], { width: 560.8 })]);
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
    const narrow = part(2000, ['left'], { width: 50.8, quantity: 3 });
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
      expect.objectContaining({ quantity: 1, width: 1121.6, edgeL1: PCV.label, edgeL2: PCV.label }),
    ]);
  });

  it('puts a wieniec on an ordinary strip once its texture is rotated in PRO100', () => {
    // PRO100 then swaps the columns, so the band moves to the length.
    const { parts } = load('Wieniec\t1024\t—\t600\t   \t18\t2\t');
    expect(run(parts).strips[0]).toMatchObject({
      crossCut: false,
      orderLength: 2760,
      stripWidth: 599.2,
      flags: [],
    });
  });

  it('12: produces the expected result for the gospodarcze file', () => {
    const { parts } = load(FORMATEK_CSV);
    const grain = Object.fromEntries(parts.map((p) => [p.material, true]));
    const result = run(parts, grain);

    expect(
      result.rows.map((r) => [r.quantity, r.length, r.width, r.thickness, r.edgeL1]),
    ).toEqual([
      [1, 613.2, 650, 18, undefined],
      [1, 2760, 614, 18, undefined],
      [2, 2760, 282, 18, undefined],
      [4, 2030, 599.2, 18, null],
      [6, 2030, 589.2, 18, null],
      [4, 2760, 599.2, 18, null],
      [1, 25, 15, 1024, undefined],
      [1, 25, 15, 1264, undefined],
    ]);
    expect(result.rows.slice(3, 5).map((r) => r.flags)).toEqual([['acrossGrain'], ['acrossGrain']]);
    const reasons = result.exceptions.map((e) => [e.part.name.split(' ')[0], e.reason]);
    expect(reasons).toEqual([
      ['Drzwi', 'finishedPart'],
      ['Drzwi', 'finishedPart'],
    ]);
    expect(result.unbanded.map((p) => p.name)).toEqual(['', '', '', 'koło', 'koło']);
  });

  it('suggests grain from the material name', () => {
    expect(suggestGrainLock('Inne\\lustro srebrne')).toBe(false);
    expect(suggestGrainLock('Biały 18mm')).toBe(false);
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
