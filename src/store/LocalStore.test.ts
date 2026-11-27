import { beforeEach, describe, expect, it } from 'vitest';
import { FACTORY_SETTINGS } from '../core/settings';
import { LocalStore, STORAGE_KEYS } from './LocalStore';

describe('LocalStore', () => {
  beforeEach(() => localStorage.clear());

  it('writes factory settings on first visit', () => {
    expect(new LocalStore(localStorage).loadSettings()).toEqual(FACTORY_SETTINGS);
    expect(localStorage.getItem(STORAGE_KEYS.settings)).not.toBeNull();
  });

  it('clearSession keeps settings and language', async () => {
    const store = new LocalStore(localStorage);
    await store.saveSettings({ ...FACTORY_SETTINGS, sawKerf: 4 });
    await store.saveLocale('pl');
    await store.saveSession({ parts: [], grainLock: {}, doubledGroups: {}, timestamp: 1 });

    await store.clearSession();

    expect(store.loadSession()).toBeNull();
    expect(store.loadSettings().sawKerf).toBe(4);
    expect(store.loadLocale()).toBe('pl');
  });
});
