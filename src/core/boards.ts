// How the strips can be ripped from whole boards. Pure.
import { binPack } from './binpack';
import { boardSize } from './settings';
import type { Settings, Strip } from './types';

export interface PlacedStrip {
  /** Index into the strip list. */
  strip: number;
  /** Position on the board, mm. x runs along the board length. */
  x: number;
  y: number;
  length: number;
  width: number;
}

export interface Board {
  material: string;
  thickness: number | null;
  /** The strips run across the grain, so the board is seen turned a quarter. */
  crossCut: boolean;
  strips: PlacedStrip[];
}

/** One piece of board ripped off: a single strip, or two still joined as a double blank. */
interface Blank {
  strips: number[];
  length: number;
  width: number;
}

/** A full-width lane: blanks of one width, end to end. */
interface Lane {
  blanks: Blank[];
  width: number;
}

const um = (mm: number) => Math.round(mm * 1000);

/** Packs sizes with one kerf between neighbors into as few bins of `capacity` as possible. */
function fit<T>(items: T[], size: (item: T) => number, capacity: number, kerf: number): T[][] {
  const sorted = [...items].sort((a, b) => size(b) - size(a));
  const packed = binPack(
    sorted.map((item) => um(size(item)) + um(kerf)),
    um(capacity) + um(kerf),
    () => 0,
  );
  return packed.bins.map((bin) => bin.map((i) => sorted[i]!));
}

function blanks(strips: Strip[], indexes: number[], sawKerf: number): Blank[] {
  const result: Blank[] = [];
  const unpaired = new Map<string, Blank>();
  for (const index of indexes) {
    const strip = strips[index]!;
    const blank = { strips: [index], length: strip.orderLength, width: strip.stripWidth };
    if (!strip.flags.includes('doubled')) {
      result.push(blank);
      continue;
    }
    const first = unpaired.get(strip.groupKey);
    if (first) {
      first.strips.push(index);
      unpaired.delete(strip.groupKey);
    } else {
      blank.width = 2 * strip.stripWidth + sawKerf;
      unpaired.set(strip.groupKey, blank);
      result.push(blank);
    }
  }
  return result;
}

/**
 * Strips of one material, thickness and direction share boards. The board is
 * ripped into lanes along the strips, and each lane is crosscut where it holds
 * several strips. Across-grain strips get boards of their own.
 * Takes strips that went through applyDoubling.
 */
export function layoutBoards(strips: Strip[], settings: Settings): Board[] {
  const { sawKerf } = settings;
  const stocks = new Map<string, number[]>();
  strips.forEach((strip, i) => {
    const key = JSON.stringify([strip.material, strip.thickness, strip.crossCut]);
    stocks.set(key, [...(stocks.get(key) ?? []), i]);
  });

  return [...stocks.values()].flatMap((indexes) => {
    const { material, thickness, crossCut } = strips[indexes[0]!]!;
    const board = boardSize(settings, crossCut);
    const byWidth = new Map<number, Blank[]>();
    for (const blank of blanks(strips, indexes, sawKerf)) {
      byWidth.set(blank.width, [...(byWidth.get(blank.width) ?? []), blank]);
    }
    const lanes: Lane[] = [...byWidth].flatMap(([width, same]) =>
      fit(same, (b) => b.length, board.length, sawKerf).map((group) => ({ width, blanks: group })),
    );

    return fit(lanes, (lane) => lane.width, board.width, sawKerf).map((onBoard) => {
      const placed: PlacedStrip[] = [];
      let y = 0;
      for (const lane of onBoard) {
        let x = 0;
        for (const blank of lane.blanks) {
          blank.strips.forEach((strip, i) => {
            const width = strips[strip]!.stripWidth;
            placed.push({ strip, x, y: y + i * (width + sawKerf), length: blank.length, width });
          });
          x += blank.length + sawKerf;
        }
        y += lane.width + sawKerf;
      }
      return { material, thickness, crossCut, strips: placed };
    });
  });
}

export interface Rect {
  x: number;
  y: number;
  length: number;
  width: number;
}

/**
 * Waste share, saw cuts and the leftover rectangles of one board.
 * A cut is counted wherever material is separated: ripping lanes and double
 * blanks along the board, then crosscutting strips and pieces.
 */
export function boardStats(board: Board, strips: Strip[], settings: Settings) {
  const { sawKerf } = settings;
  const { length: maxLength, width: maxWidth } = boardSize(settings, board.crossCut);
  let cuts = 0;
  let cutLength = 0;
  let used = 0;
  const offcuts: Rect[] = [];
  const cut = (length: number) => {
    cuts++;
    cutLength += length;
  };
  const leftover = (x: number, y: number, length: number, width: number) => {
    if (length > 0 && width > 0) offcuts.push({ x, y, length, width });
  };
  const end = (items: number[]) => Math.max(0, ...items);

  // Strips starting at x = 0 mark the top of each lane or the second half of a double blank.
  const rows = board.strips.filter((s) => s.x === 0);
  for (const row of rows) {
    if (row.y + row.width < maxWidth - 1e-6) cut(maxLength);
  }

  for (const placed of board.strips) {
    const strip = strips[placed.strip]!;
    let x = 0;
    strip.pieces.forEach((piece, i) => {
      used += piece.length * strip.stripWidth;
      x += piece.length + (i > 0 ? sawKerf : 0);
      if (i < strip.pieces.length - 1 || x < placed.length - 1e-6) cut(placed.width);
    });
    leftover(placed.x + x + sawKerf, placed.y, placed.length - x - sawKerf, placed.width);
    if (placed.x + placed.length < maxLength - 1e-6) cut(placed.width);
  }

  for (const row of rows) {
    const inRow = board.strips.filter((s) => s.y === row.y);
    const right = end(inRow.map((s) => s.x + s.length)) + sawKerf;
    leftover(right, row.y, maxLength - right, row.width);
  }
  const bottom = end(board.strips.map((s) => s.y + s.width)) + sawKerf;
  leftover(0, bottom, maxLength, maxWidth - bottom);

  return {
    wastePercent: (1 - used / (maxLength * maxWidth)) * 100,
    cuts,
    /** mm */
    cutLength,
    offcuts,
  };
}
