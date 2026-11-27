// The whole calculation from parsed parts to result lists. Pure.
import { layoutBoards } from './boards';
import { classify } from './classify';
import { applyDoubling, collapseExceptions, collapseParts, orderRows } from './order';
import { pack } from './pack';
import type { Part, Settings } from './types';

export function calculate(
  parts: Part[],
  settings: Settings,
  grainLock: Record<string, boolean>,
  doubled: Record<string, boolean>,
) {
  const classified = classify(parts, settings, grainLock);
  const packed = pack(classified.candidates, settings);
  const strips = applyDoubling(packed.strips, settings, doubled);
  return {
    strips,
    rows: orderRows(strips, settings),
    boards: layoutBoards(strips, settings),
    exceptions: collapseExceptions([...classified.exceptions, ...packed.exceptions]),
    unbanded: collapseParts(classified.unbanded),
    proven: packed.proven,
  };
}

export type Result = ReturnType<typeof calculate>;
