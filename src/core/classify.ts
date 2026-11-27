// Pure: no DOM, storage or dictionaries (PRD section 15).
import { round } from './numbers';
import { boardSize } from './settings';
import type { Candidate, Edge, Part, PartException, ReasonId, Settings } from './types';

export interface Classification {
  candidates: Candidate[];
  exceptions: PartException[];
  /** Listed for the "No banding" tab; those that fit the board are candidates too. */
  unbanded: Part[];
}

/** No edge fixes the orientation, so the length stays along the strip. */
function classifyUnbanded(part: Part, settings: Settings): Candidate | ReasonId {
  const boardWidth = round(part.width, settings.orderDecimals);
  if (boardWidth <= 0) return 'nonPositiveWidth';
  if (boardWidth > settings.maxWidth) return 'widthExceedsBoard';
  return {
    part,
    pieceLength: part.length,
    boardWidth,
    edgeL1: undefined,
    edgeL2: undefined,
    edgeThickness: 0,
    crossCut: false,
  };
}

function classifyPart(part: Part, settings: Settings, grainLock: boolean): Candidate | ReasonId {
  const edges = Object.keys(part.edges) as Edge[];
  if (edges.length >= 3) return 'finishedPart';

  const alongGrain = edges.filter((e) => e === 'left' || e === 'right').length;
  if (edges.length === 2 && alongGrain === 1) return 'adjacentEdges';

  const products = edges.map((edge) => ({
    label: part.edges[edge]!.label ?? settings.defaultEdgeLabel,
    thickness: part.edges[edge]!.thickness ?? settings.defaultEdgeThickness,
  }));
  const product = products[0]!;
  if (products.some((p) => p.label !== product.label || p.thickness !== product.thickness)) {
    return 'mixedEdgeProducts';
  }

  // Banding on the width turns the part, so its width lies along the strip.
  const turned = alongGrain === 0;
  // Keeping the grain then means the strip itself must run across the board.
  // Without grain the direction does not matter, and it is a strip like any other.
  const crossCut = turned && grainLock;

  const pieceLength = turned ? part.width : part.length;
  const perpendicular = turned ? part.length : part.width;
  const exact = settings.subtractEdge
    ? perpendicular - edges.length * product.thickness
    : perpendicular;
  const boardWidth = round(exact, settings.orderDecimals);
  if (boardWidth <= 0) return 'nonPositiveWidth';
  if (boardWidth > boardSize(settings, crossCut).width) return 'widthExceedsBoard';

  return {
    part,
    pieceLength,
    boardWidth,
    edgeL1: product.label,
    edgeL2: edges.length === 2 ? product.label : undefined,
    edgeThickness: product.thickness,
    crossCut,
  };
}

/** PRD sections 11-12. A material missing from grainLock keeps its grain. */
export function classify(
  parts: Part[],
  settings: Settings,
  grainLock: Record<string, boolean>,
): Classification {
  const result: Classification = { candidates: [], exceptions: [], unbanded: [] };
  for (const part of parts) {
    const bare = Object.keys(part.edges).length === 0;
    if (bare) result.unbanded.push(part);
    const outcome = bare
      ? classifyUnbanded(part, settings)
      : classifyPart(part, settings, grainLock[part.material] ?? true);
    if (typeof outcome === 'string') result.exceptions.push({ part, reason: outcome });
    else result.candidates.push(outcome);
  }
  return result;
}
