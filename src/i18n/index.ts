import { en, type MessageId } from './en';
import { pl } from './pl';

export type { MessageId };
export type Locale = 'en' | 'pl';

export const dictionaries: Record<Locale, Record<MessageId, string>> = { en, pl };

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', pl: 'Polski' };

/** A missing key shows up as the key itself (PRD section 7). */
export function t(locale: Locale, id: MessageId): string {
  return dictionaries[locale][id] ?? id;
}

export function detectLocale(language: string): Locale {
  return language.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}
