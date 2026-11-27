import type { Settings } from './types';

// The only place factory numbers live (PRD section 8).
export const FACTORY_SETTINGS: Readonly<Settings> = {
  maxLength: 2760,
  maxWidth: 2030,
  sawKerf: 3.2,
  trimAllowance: 10,
  subtractEdge: false,
  defaultEdgeThickness: 0.8,
  defaultEdgeLabel: null,
  minStripWidth: 70,
  shortStrips: false,
  shortStripRatio: 0.4,
  orderDecimals: 1,
  fitNarrower: true,
  minOffcut: 300,
};

/** The longest and widest strip a board gives, in the direction the strip is ripped. */
export function boardSize(settings: Settings, crossCut: boolean) {
  const { maxLength, maxWidth } = settings;
  return crossCut ? { length: maxWidth, width: maxLength } : { length: maxLength, width: maxWidth };
}
