import { beforeEach, describe, expect, it } from 'vitest';
import { FACTORY_SETTINGS } from '../core/settings';
import { LocalStore, STORAGE_KEYS } from './LocalStore';

describe('LocalStore', () => {
  beforeEach(() => localStorage.clear());

  it('writes factory settings on first visit', () => {
    expect(new LocalStore(localStorage).loadSettings()).toEqual(FACTORY_SETTINGS);
    expect(localStorage.getItem(STORAGE_KEYS.settings)).not.toBeNull();
  });

  it('keeps settings and language across visits', async () => {
    const store = new LocalStore(localStorage);
    await store.saveSettings({ ...FACTORY_SETTINGS, sawKerf: 4 });
    await store.saveLocale('pl');

    const next = new LocalStore(localStorage);

    expect(next.loadSettings().sawKerf).toBe(4);
    expect(next.loadLocale()).toBe('pl');
  });

  it('deletes the job an earlier release had saved', () => {
    localStorage.setItem('stolash.session.v1', '{"parts":[]}');
    new LocalStore(localStorage);
    expect(localStorage.getItem('stolash.session.v1')).toBeNull();
  });
});
