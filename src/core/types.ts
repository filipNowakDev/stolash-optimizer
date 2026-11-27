// Domain model (PRD sections 8-13). All lengths are millimeters.

export type Edge = 'left' | 'right' | 'top' | 'bottom';

export type ReasonId =
  | 'badDimension'
  | 'badQuantity'
  | 'unknownEdge'
  | 'nonPositiveWidth'
  | 'widthExceedsBoard'
  | 'longerThanBoard'
  | 'crossGrain'
  | 'adjacentEdges'
  | 'finishedPart'
  | 'mixedEdgeProducts';

export type StripFlag = 'short' | 'narrow' | 'doubled' | 'acrossGrain' | 'trimTight';

export interface Settings {
  maxLength: number;
  maxWidth: number;
  sawKerf: number;
  trimAllowance: number;
  dimensionsIncludeEdge: boolean;
  defaultEdgeThickness: number;
  /** null until the user edits it; the UI then generates it from locale and thickness. */
  defaultEdgeLabel: string | null;
  minStripWidth: number;
  shortStripRatio: number;
  orderDecimals: number;
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
  edgeL1: EdgeLabel;
  /** undefined when only L1 is banded. */
  edgeL2: EdgeLabel | undefined;
  edgeThickness: number;
  acrossGrain: boolean;
}

export interface PartException {
  part: Part;
  reason: ReasonId;
}

export interface StripPiece {
  name: string;
  length: number;
}

export interface Strip {
  groupKey: string;
  material: string;
  thickness: number | null;
  edgeL1: EdgeLabel;
  edgeL2: EdgeLabel | undefined;
  stripWidth: number;
  orderLength: number;
  pieces: StripPiece[];
  usedLength: number;
  offcut: number;
  flags: StripFlag[];
}
