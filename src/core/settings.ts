import type { Settings } from './types';

// The only place factory numbers live (PRD section 8).
export const FACTORY_SETTINGS: Readonly<Settings> = {
  maxLength: 2760,
  maxWidth: 2030,
  sawKerf: 3.2,
  trimAllowance: 10,
  dimensionsIncludeEdge: true,
  defaultEdgeThickness: 0.8,
  defaultEdgeLabel: null,
  minStripWidth: 70,
  shortStripRatio: 0.4,
  orderDecimals: 1,
};
