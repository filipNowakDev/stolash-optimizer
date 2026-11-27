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

export interface Part {
  name: string;
  material: string;
  thickness: number | null;
  length: number;
  width: number;
  quantity: number;
  edges: Edge[];
  edgeLabel: string;
  edgeThickness: number;
}

export interface StripPiece {
  name: string;
  length: number;
}

export interface Strip {
  material: string;
  thickness: number | null;
  edgeL1: string;
  edgeL2: string;
  stripWidth: number;
  orderLength: number;
  pieces: StripPiece[];
  usedLength: number;
  offcut: number;
  flags: StripFlag[];
}
