// Pure: no DOM, storage or dictionaries (PRD section 15).
import type { Part, ReasonId, Settings } from './types';

export interface Classification {
  candidates: Part[];
  exceptions: { part: Part; reason: ReasonId }[];
  unbanded: Part[];
}

/** PRD sections 11-12. */
export function classify(_parts: Part[], _settings: Settings): Classification {
  throw new Error('classify: not implemented');
}
