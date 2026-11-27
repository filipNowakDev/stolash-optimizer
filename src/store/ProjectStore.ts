// Storage seam (PRD section 16). Views never touch localStorage directly.
import type { ColumnMap, SkippedRow } from '../core/parse';
import type { Part, Settings } from '../core/types';
import type { Locale } from '../i18n';

export type { ColumnMap };

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
  /** The chosen way of cutting; the first one when absent. */
  version?: string;
  grainLock: Record<string, boolean>;
  doubledGroups: Record<string, boolean>;
  timestamp: number;
  /** null until Generate is pressed. */
  generated?: Snapshot | null;
}

export interface ProjectStore {
  loadSettings(): Settings;
  saveSettings(settings: Settings): Promise<void>;
  loadColumnMap(): ColumnMap | null;
  saveColumnMap(map: ColumnMap): Promise<void>;
  loadLocale(): Locale | null;
  saveLocale(locale: Locale): Promise<void>;
  loadSession(): Session | null;
  saveSession(session: Session): Promise<void>;
  clearSession(): Promise<void>;
}
