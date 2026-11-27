import { describe, expect, it } from 'vitest';
import { detectLocale, dictionaries } from '.';

describe('i18n', () => {
  it('has the same ids in both languages', () => {
    expect(Object.keys(dictionaries.pl).sort()).toEqual(Object.keys(dictionaries.en).sort());
  });

  it('picks Polish only for pl browser languages', () => {
    expect(detectLocale('pl-PL')).toBe('pl');
    expect(detectLocale('en-GB')).toBe('en');
    expect(detectLocale('de-DE')).toBe('en');
  });
});
