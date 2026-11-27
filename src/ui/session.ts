// The current job. It lives in memory only: every visit starts empty (PRD section 14).
import type { SkippedRow } from '../core/parse';
import type { Part, Settings } from '../core/types';

/** The inputs the shown results were generated from. */
export interface Snapshot {
  settings: Settings;
  excluded: number[];
  grainLock: Record<string, boolean>;
}

export interface Session {
  parts: Part[];
  skipped: SkippedRow[];
  /** Indexes into parts that the user left out. */
  excluded: number[];
  grainLock: Record<string, boolean>;
  doubledGroups: Record<string, boolean>;
  /** The chosen way of cutting; the first one when absent. */
  version?: string;
  /** null until Generate is pressed. */
  generated: Snapshot | null;
}
