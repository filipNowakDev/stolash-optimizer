import type { Settings } from '../core/types';
import type { MessageId } from '../i18n';

export type NumericField = {
  [K in keyof Settings]: Settings[K] extends number ? K : never;
}[keyof Settings];

export function parseInput(text: string): number | null {
  const clean = text.replace(/\s/g, '').replace(',', '.');
  return /^(\d+(\.\d*)?|\.\d+)$/.test(clean) ? Number(clean) : null;
}

/** The message to show on the field, or null when the value can be saved. */
export function validate(
  field: NumericField,
  value: number | null,
  settings: Settings,
): MessageId | null {
  switch (field) {
    case 'sawKerf':
      return value === null ? 'invalid.nonNegative' : null;
    case 'trimAllowance':
      if (value === null) return 'invalid.nonNegative';
      return value < settings.maxLength ? null : 'invalid.trim';
    case 'shortStripRatio':
      return value !== null && value <= 1 ? null : 'invalid.ratio';
    case 'orderDecimals':
      return value !== null && Number.isInteger(value) && value <= 3 ? null : 'invalid.decimals';
    case 'maxLength':
      if (value === null || value <= 0) return 'invalid.positive';
      return value > settings.trimAllowance ? null : 'invalid.trim';
    default:
      return value !== null && value > 0 ? null : 'invalid.positive';
  }
}
