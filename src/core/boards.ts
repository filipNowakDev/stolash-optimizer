// How the strips can be ripped from whole boards. Pure and deterministic.
//
// Strips are rectangles on a board whose grain runs along x. They are never
// rotated against the grain: an along-grain strip lies along x, an across-grain
// strip along y. Every cut is a guillotine cut, edge to edge of the piece it
// divides. The goal is the fewest boards, then the fewest meters of cuts.
import type { Settings, Strip } from './types';

export interface Rect {
  x: number;
  y: number;
  /** Size along the board length. */
  dx: number;
  /** Size across it. */
  dy: number;
}

/** One piece the wholesaler delivers: a strip, or two still joined as a double blank. */
export interface Blank extends Rect {
  /** Indexes into the strip list. */
  strips: number[];
  /** The strip runs across the grain, so along y. */
  turned: boolean;
  /** Along the strip. */
  length: number;
  /** Across the strip. */
  width: number;
}

export interface Board {
  material: string;
  thickness: number | null;
  blanks: Blank[];
  /** Leftovers of the board outside every strip. */
  free: Rect[];
  /** The wholesaler's cuts. */
  cuts: number;
  /** mm */
  cutLength: number;
}

type Item = Omit<Blank, 'x' | 'y'>;

/** Integer micrometers keep sums and comparisons exact. */
const um = (mm: number) => Math.round(mm * 1000);

function items(strips: Strip[], indexes: number[], sawKerf: number): Item[] {
  const result: Item[] = [];
  const unpaired = new Map<string, Item>();
  const size = (item: Item) => {
    item.dx = item.turned ? item.width : item.length;
    item.dy = item.turned ? item.length : item.width;
  };
  for (const index of indexes) {
    const strip = strips[index]!;
    const doubled = strip.flags.includes('doubled');
    const first = doubled ? unpaired.get(strip.groupKey) : undefined;
    if (first) {
      first.strips.push(index);
      unpaired.delete(strip.groupKey);
      continue;
    }
    const item: Item = {
      strips: [index],
      turned: strip.crossCut,
      length: strip.orderLength,
      width: doubled ? 2 * strip.stripWidth + sawKerf : strip.stripWidth,
      dx: 0,
      dy: 0,
    };
    size(item);
    if (doubled) unpaired.set(strip.groupKey, item);
    result.push(item);
  }
  return result;
}

/** Which free rectangle takes the next item: lower is better. */
const FITS: ((free: Rect, item: Item) => number[])[] = [
  (f, i) => [f.dx * f.dy - um(i.dx) * um(i.dy)],
  (f, i) => [Math.min(f.dx - um(i.dx), f.dy - um(i.dy))],
  (f) => [f.y, f.x],
  (f) => [f.x, f.y],
];

/** Whether the first cut runs the whole free rectangle along x (rather than along y). */
const SPLITS: ((free: Rect, dx: number, dy: number) => boolean)[] = [
  () => true,
  () => false,
  (f, dx, dy) => f.dx - dx < f.dy - dy,
  (f, dx, dy) => f.dx - dx >= f.dy - dy,
  // Keep the largest single leftover.
  (f, dx, dy) => f.dx * (f.dy - dy) >= (f.dx - dx) * f.dy,
];

const ORDERS: ((item: Item) => number[])[] = [
  (i) => [i.dy, i.dx],
  (i) => [i.dx, i.dy],
  (i) => [i.dx * i.dy, i.dy],
  (i) => [Math.max(i.dx, i.dy), Math.min(i.dx, i.dy)],
  (i) => [i.dx + i.dy, i.dy],
];

const compare = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return 0;
};

interface Sheet {
  blanks: Blank[];
  /** In micrometers. */
  free: Rect[];
  cuts: number;
  cutLength: number;
}

/** Places the items one by one. Every item must fit an empty board. */
function place(
  order: Item[],
  boardDx: number,
  boardDy: number,
  kerf: number,
  fit: (typeof FITS)[number],
  split: (typeof SPLITS)[number],
): Sheet[] {
  const sheets: Sheet[] = [];
  for (const item of order) {
    const dx = um(item.dx);
    const dy = um(item.dy);
    let choice: { sheet: Sheet; at: number; score: number[] } | null = null;
    for (const sheet of sheets) {
      for (let at = 0; at < sheet.free.length; at++) {
        const f = sheet.free[at]!;
        if (dx > f.dx || dy > f.dy) continue;
        const score = fit(f, item);
        if (!choice || compare(score, choice.score) < 0) choice = { sheet, at, score };
      }
    }
    if (!choice) {
      const sheet = { blanks: [], free: [{ x: 0, y: 0, dx: boardDx, dy: boardDy }], cuts: 0, cutLength: 0 };
      sheets.push(sheet);
      choice = { sheet, at: 0, score: [] };
    }

    const { sheet } = choice;
    const f = sheet.free.splice(choice.at, 1)[0]!;
    const alongX = split(f, dx, dy);
    const cut = (length: number) => {
      sheet.cuts++;
      sheet.cutLength += length;
    };
    const keep = (rect: Rect) => {
      if (rect.dx > 0 && rect.dy > 0) sheet.free.push(rect);
    };
    if (dy < f.dy) cut(alongX ? f.dx : dx);
    if (dx < f.dx) cut(alongX ? dy : f.dy);
    keep({ x: f.x, y: f.y + dy + kerf, dx: alongX ? f.dx : dx, dy: f.dy - dy - kerf });
    keep({ x: f.x + dx + kerf, y: f.y, dx: f.dx - dx - kerf, dy: alongX ? dy : f.dy });
    sheet.blanks.push({ ...item, x: f.x / 1000, y: f.y / 1000 });
  }
  return sheets;
}

const total = (sheets: Sheet[]) => sheets.reduce((sum, s) => sum + s.cutLength, 0);

/** What a layout choice compares, most important first; lower is better. */
const CHOICES = {
  /** Shortest wholesaler cuts. */
  cuts: (sheets: Sheet[]) => [sheets.length, total(sheets), -chunks(sheets)],
  /** Leftovers in the largest pieces: squares reward one big piece over two small. */
  offcuts: (sheets: Sheet[]) => [sheets.length, -chunks(sheets), total(sheets)],
};
export type Choice = keyof typeof CHOICES;

const chunks = (sheets: Sheet[]) =>
  sheets.reduce((sum, s) => s.free.reduce((a, f) => a + ((f.dx * f.dy) / 1e12) ** 2, sum), 0);

/** Near-best layouts kept per choice, so there is something to compare. */
const KEPT = 4;

/**
 * Tries many orders and rules and keeps the best few different ones for each
 * choice, best first. A heuristic, not a proof.
 */
function pack(
  list: Item[],
  boardDx: number,
  boardDy: number,
  kerf: number,
  restarts: number,
): Record<Choice, Sheet[][]> {
  const choices = Object.keys(CHOICES) as Choice[];
  const kept = Object.fromEntries(choices.map((c) => [c, []])) as unknown as Record<
    Choice,
    { score: number[]; sheets: Sheet[] }[]
  >;
  const consider = (order: Item[], fit: number, split: number) => {
    const sheets = place(order, boardDx, boardDy, kerf, FITS[fit]!, SPLITS[split]!);
    for (const choice of choices) {
      const top = kept[choice];
      const score = CHOICES[choice](sheets);
      if (top.length === KEPT && compare(score, top[KEPT - 1]!.score) >= 0) continue;
      if (top.some((other) => compare(score, other.score) === 0)) continue;
      top.push({ score, sheets });
      top.sort((a, b) => compare(a.score, b.score));
      top.length = Math.min(top.length, KEPT);
    }
  };
  const sorted = ORDERS.map((key) => [...list].sort((a, b) => compare(key(b), key(a))));
  for (const order of sorted) {
    for (let fit = 0; fit < FITS.length; fit++) {
      for (let split = 0; split < SPLITS.length; split++) consider(order, fit, split);
    }
  }

  // Seeded, so the same job always gives the same layout.
  let seed = 1;
  const random = (n: number) => (seed = (seed * 48271) % 2147483647) % n;
  for (let run = 0; run < restarts && list.length > 1; run++) {
    const order = [...sorted[random(sorted.length)]!];
    for (let swaps = 1 + random(4); swaps > 0; swaps--) {
      const a = random(order.length);
      const b = random(order.length);
      [order[a], order[b]] = [order[b]!, order[a]!];
    }
    consider(order, random(FITS.length), random(SPLITS.length));
  }
  return Object.fromEntries(choices.map((c) => [c, kept[c].map((k) => k.sheets)])) as Record<
    Choice,
    Sheet[][]
  >;
}

/**
 * Several layouts of the same strips; the first has the fewest boards and the
 * shortest cuts. Takes strips that went through applyDoubling. Material and
 * thickness never share a board.
 */
export function layoutChoices(strips: Strip[], settings: Settings, effort?: number): Board[][] {
  const { maxLength, maxWidth, sawKerf } = settings;
  const stocks = new Map<string, number[]>();
  strips.forEach((strip, i) => {
    const key = JSON.stringify([strip.material, strip.thickness]);
    stocks.set(key, [...(stocks.get(key) ?? []), i]);
  });

  const choices = Object.keys(CHOICES) as Choice[];
  const result: Board[][] = Array.from({ length: KEPT * choices.length }, () => []);
  for (const indexes of stocks.values()) {
    const { material, thickness } = strips[indexes[0]!]!;
    const list = items(strips, indexes, sawKerf);
    // Fewer restarts for big jobs, to stay responsive.
    const restarts = effort ?? (list.length > 80 ? 200 : 1500);
    const packed = pack(list, um(maxLength), um(maxWidth), um(sawKerf), restarts);
    const board = (sheet: Sheet): Board => ({
      material,
      thickness,
      blanks: sheet.blanks,
      free: sheet.free.map((f) => ({
        x: f.x / 1000,
        y: f.y / 1000,
        dx: f.dx / 1000,
        dy: f.dy / 1000,
      })),
      cuts: sheet.cuts,
      cutLength: sheet.cutLength / 1000,
    });
    result.forEach((layout, i) => {
      const top = packed[choices[i % choices.length]!];
      // A material with fewer different layouts repeats its last one.
      const sheets = top[Math.min(Math.floor(i / choices.length), top.length - 1)] ?? [];
      layout.push(...sheets.map(board));
    });
  }
  return result;
}

/** The layout with the fewest boards, then the shortest cuts. */
export const layoutBoards = (strips: Strip[], settings: Settings, effort?: number): Board[] =>
  layoutChoices(strips, settings, effort)[0]!;

/** Waste share, the shop's cuts and every leftover rectangle of one board. */
export function boardStats(board: Board, strips: Strip[], settings: Settings) {
  const { maxLength, maxWidth, sawKerf } = settings;
  let used = 0;
  let own = 0;
  let ownLength = 0;
  const offcuts: Rect[] = [...board.free];
  const cut = (length: number) => {
    own++;
    ownLength += length;
  };

  for (const blank of board.blanks) {
    // The shop rips a double blank apart.
    if (blank.strips.length === 2) cut(blank.length);
    blank.strips.forEach((index, half) => {
      const strip = strips[index]!;
      let end = 0;
      strip.pieces.forEach((piece, i) => {
        used += piece.length * piece.width;
        end += piece.length + (i > 0 ? sawKerf : 0);
        // A narrower part is also ripped to width.
        if (piece.width < strip.stripWidth - 1e-6) cut(piece.length);
        if (i < strip.pieces.length - 1 || end < blank.length - 1e-6) cut(strip.stripWidth);
      });
      const along = end + sawKerf;
      const rest = blank.length - along;
      if (rest <= 0) return;
      const across = half * (strip.stripWidth + sawKerf);
      offcuts.push(
        blank.turned
          ? { x: blank.x + across, y: blank.y + along, dx: strip.stripWidth, dy: rest }
          : { x: blank.x + along, y: blank.y + across, dx: rest, dy: strip.stripWidth },
      );
    });
  }

  return { wastePercent: (1 - used / (maxLength * maxWidth)) * 100, own, ownLength, offcuts };
}
