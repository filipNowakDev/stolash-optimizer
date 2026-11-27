import type { Part, Settings } from './types';

/** Decoding, delimiter detection and column mapping (PRD section 9). */
export function parse(_text: string, _settings: Settings): Part[] {
  throw new Error('parse: not implemented');
}
