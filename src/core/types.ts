// Domain model (PRD sections 8-13). All lengths are millimeters.

export type Edge = 'left' | 'right' | 'top' | 'bottom';

export type ReasonId =
  | 'badDimension'
  | 'badQuantity'
  | 'unknownEdge'
  | 'nonPositiveWidth'
  | 'widthExceedsBoard'
  | 'longerThanBoard'
  | 'adjacentEdges'
  | 'finishedPart'
  | 'mixedEdgeProducts';

export type StripFlag = 'short' | 'narrow' | 'doubled' | 'acrossGrain' | 'trimTight';

export interface Settings {
  maxLength: number;
  maxWidth: number;
  sawKerf: number;
  trimAllowance: number;
  /**
   * Order narrower than the file by the banding. Off by default: the wholesaler
   * mills the edge by that amount before gluing.
   */
  subtractEdge: boolean;
  defaultEdgeThickness: number;
  /** null until the user edits it; the UI then generates it from locale and thickness. */
  defaultEdgeLabel: string | null;
  minStripWidth: number;
  /** Order a poorly filled strip shorter than the board. */
  shortStrips: boolean;
  shortStripRatio: number;
  orderDecimals: number;
  /** Put narrower parts on wider strips when that orders less material. */
  fitNarrower: boolean;
  /** A leftover with both sides at least this long counts as reusable. */
  minOffcut: number;
}

/** null means "take it from settings", so a settings change applies to parsed parts. */
export interface EdgeProduct {
  label: string | null;
  thickness: number | null;
}

export type Edges = Partial<Record<Edge, EdgeProduct>>;

export interface Part {
  name: string;
  material: string;
  thickness: number | null;
  length: number;
  width: number;
  quantity: number;
  edges: Edges;
}

/** null is the default edge label, resolved at render time. */
export type EdgeLabel = string | null;

/** A part that can go on a strip, already oriented. */
export interface Candidate {
  part: Part;
  pieceLength: number;
  /** Rounded to orderDecimals. */
  boardWidth: number;
  /** undefined for an unbanded strip. */
  edgeL1: EdgeLabel | undefined;
  /** undefined when at most L1 is banded. */
  edgeL2: EdgeLabel | undefined;
  edgeThickness: number;
  /** Ripped across the board to keep the grain, so no longer than the board is wide. */
  crossCut: boolean;
}

export interface PartException {
  part: Part;
  reason: ReasonId;
}

export interface StripPiece {
  name: string;
  length: number;
  /** Board width of the part. Less than the strip width means the shop rips it. */
  width: number;
}

export interface Strip {
  groupKey: string;
  material: string;
  thickness: number | null;
  edgeL1: EdgeLabel | undefined;
  edgeL2: EdgeLabel | undefined;
  stripWidth: number;
  crossCut: boolean;
  orderLength: number;
  pieces: StripPiece[];
  usedLength: number;
  offcut: number;
  flags: StripFlag[];
}
