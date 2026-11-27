// Pure: no DOM, storage or dictionaries (PRD section 15).
import { round } from './numbers';
import type { Candidate, Edge, Part, PartException, ReasonId, Settings } from './types';

export interface Classification {
  candidates: Candidate[];
  exceptions: PartException[];
  unbanded: Part[];
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

  const acrossGrain = alongGrain === 0;
  if (acrossGrain && grainLock) return 'crossGrain';

  const pieceLength = acrossGrain ? part.width : part.length;
  const perpendicular = acrossGrain ? part.length : part.width;
  const exact = settings.dimensionsIncludeEdge
    ? perpendicular - edges.length * product.thickness
    : perpendicular;
  const boardWidth = round(exact, settings.orderDecimals);
  if (boardWidth <= 0) return 'nonPositiveWidth';
  if (boardWidth > settings.maxWidth) return 'widthExceedsBoard';

  return {
    part,
    pieceLength,
    boardWidth,
    edgeL1: product.label,
    edgeL2: edges.length === 2 ? product.label : undefined,
    edgeThickness: product.thickness,
    acrossGrain,
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
    if (Object.keys(part.edges).length === 0) {
      result.unbanded.push(part);
      continue;
    }
    const outcome = classifyPart(part, settings, grainLock[part.material] ?? true);
    if (typeof outcome === 'string') result.exceptions.push({ part, reason: outcome });
    else result.candidates.push(outcome);
  }
  return result;
}
