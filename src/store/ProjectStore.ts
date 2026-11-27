// Storage seam (PRD section 16). Views never touch localStorage directly.
import type { ColumnMap } from '../core/parse';
import type { Settings } from '../core/types';
import type { Locale } from '../i18n';

export type { ColumnMap };

export interface ProjectStore {
  loadSettings(): Settings;
  saveSettings(settings: Settings): Promise<void>;
  loadColumnMap(): ColumnMap | null;
  saveColumnMap(map: ColumnMap): Promise<void>;
  loadLocale(): Locale | null;
  saveLocale(locale: Locale): Promise<void>;
}
