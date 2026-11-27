// Edge banding the wholesaler applies. Pure.
import type { Edge, EdgeLabel, PartException, ReasonId, Settings, Strip } from './types';

/** Exceptions the wholesaler makes whole. The rest cannot be ordered as they are. */
export const WHOLE_REASONS: ReasonId[] = ['finishedPart', 'adjacentEdges', 'mixedEdgeProducts'];

export interface Banding {
  /** null is the default edge label. */
  label: EdgeLabel;
  /** Along ordered strips, mm. */
  strips: number;
  /** On elements ordered whole, mm. */
  whole: number;
}

/**
 * Net lengths per edge product: a strip is banded along its whole order length,
 * on one side or two. No allowance for trimming or waste is added.
 */
export function banding(
  strips: Strip[],
  exceptions: PartException[],
  settings: Settings,
): Banding[] {
  const products = new Map<EdgeLabel, Banding>();
  const add = (label: EdgeLabel, on: 'strips' | 'whole', length: number) => {
    const entry = products.get(label) ?? { label, strips: 0, whole: 0 };
    entry[on] += length;
    products.set(label, entry);
  };

  for (const strip of strips) {
    for (const label of [strip.edgeL1, strip.edgeL2]) {
      if (label !== undefined) add(label, 'strips', strip.orderLength);
    }
  }
  for (const { part, reason } of exceptions) {
    if (!WHOLE_REASONS.includes(reason)) continue;
    for (const edge of Object.keys(part.edges) as Edge[]) {
      // Left and right edges run along the length, top and bottom along the width.
      const side = edge === 'left' || edge === 'right' ? part.length : part.width;
      add(part.edges[edge]!.label ?? settings.defaultEdgeLabel, 'whole', side * part.quantity);
    }
  }
  return [...products.values()];
}
