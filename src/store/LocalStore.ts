import { FACTORY_SETTINGS } from '../core/settings';
import type { Settings } from '../core/types';
import type { Locale } from '../i18n';
import type { ColumnMap, ProjectStore, Session } from './ProjectStore';

export const STORAGE_KEYS = {
  settings: 'stolash.settings.v1',
  locale: 'stolash.locale.v1',
  columnMap: 'stolash.columnMap.v1',
  session: 'stolash.session.v1',
} as const;

export class LocalStore implements ProjectStore {
  constructor(private readonly storage: Storage) {}

  loadSettings(): Settings {
    const stored = this.read<Settings>(STORAGE_KEYS.settings);
    if (stored) return stored;
    const factory = { ...FACTORY_SETTINGS };
    void this.saveSettings(factory);
    return factory;
  }

  async saveSettings(settings: Settings): Promise<void> {
    this.write(STORAGE_KEYS.settings, settings);
  }

  loadColumnMap(): ColumnMap {
    return this.read<ColumnMap>(STORAGE_KEYS.columnMap) ?? {};
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

  loadSession(): Session | null {
    return this.read<Session>(STORAGE_KEYS.session);
  }

  async saveSession(session: Session): Promise<void> {
    this.write(STORAGE_KEYS.session, session);
  }

  async clearSession(): Promise<void> {
    this.storage.removeItem(STORAGE_KEYS.session);
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
