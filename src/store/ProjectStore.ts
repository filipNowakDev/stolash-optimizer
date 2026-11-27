// Storage seam (PRD section 16). Views never touch localStorage directly.
import type { ColumnMap, SkippedRow } from '../core/parse';
import type { Part, Settings } from '../core/types';
import type { Locale } from '../i18n';

export type { ColumnMap };

export interface Session {
  parts: Part[];
  skipped: SkippedRow[];
  grainLock: Record<string, boolean>;
  doubledGroups: Record<string, boolean>;
  timestamp: number;
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
