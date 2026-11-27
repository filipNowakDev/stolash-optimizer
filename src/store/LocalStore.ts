import { FACTORY_SETTINGS } from '../core/settings';
import type { Settings } from '../core/types';
import type { Locale } from '../i18n';
import type { ColumnMap, ProjectStore } from './ProjectStore';

export const STORAGE_KEYS = {
  settings: 'stolash.settings.v1',
  locale: 'stolash.locale.v1',
  columnMap: 'stolash.columnMap.v1',
} as const;

export class LocalStore implements ProjectStore {
  constructor(private readonly storage: Storage) {
    // Earlier releases kept the job between visits; do not leave it behind.
    storage.removeItem('stolash.session.v1');
  }

  loadSettings(): Settings {
    const stored = this.read<Settings>(STORAGE_KEYS.settings);
    // Spread over the factory values so a field added later is never undefined.
    if (stored) return { ...FACTORY_SETTINGS, ...stored };
    const factory = { ...FACTORY_SETTINGS };
    void this.saveSettings(factory);
    return factory;
  }

  async saveSettings(settings: Settings): Promise<void> {
    this.write(STORAGE_KEYS.settings, settings);
  }

  loadColumnMap(): ColumnMap | null {
    return this.read<ColumnMap>(STORAGE_KEYS.columnMap);
  }

  async saveColumnMap(map: ColumnMap): Promise<void> {
    this.write(STORAGE_KEYS.columnMap, map);
  }

  loadLocale(): Locale | null {
    const value = this.storage.getItem(STORAGE_KEYS.locale);
    return value === 'en' || value === 'pl' ? value : null;
  }

  async saveLocale(locale: Locale): Promise<void> {
    this.storage.setItem(STORAGE_KEYS.locale, locale);
  }

  private read<T>(key: string): T | null {
    const raw = this.storage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    this.storage.setItem(key, JSON.stringify(value));
  }
}
