// Locale affects display and export text only (PRD section 7).
import { round } from '../core/numbers';
import type { EdgeLabel, Settings, Strip } from '../core/types';
import { t, type Locale } from '../i18n';

export function formatNumber(locale: Locale, value: number, decimals = 3): string {
  const text = String(round(value, decimals));
  return locale === 'pl' ? text.replace('.', ',') : text;
}

export function defaultEdgeLabel(locale: Locale, settings: Settings): string {
  return (
    settings.defaultEdgeLabel ??
    t(locale, 'settings.defaultLabel', {
      t: formatNumber(locale, settings.defaultEdgeThickness),
    })
  );
}

export function edgeName(locale: Locale, settings: Settings, label: EdgeLabel | undefined) {
  if (label === undefined) return '';
  return label ?? defaultEdgeLabel(locale, settings);
}

export const materialName = (locale: Locale, material: string) =>
  material || t(locale, 'material.none');

/** "720 + kerf 3.2 + 564" */
export function cutSequence(locale: Locale, strip: Strip, settings: Settings): string {
  const kerf = `${t(locale, 'preview.kerf')} ${formatNumber(locale, settings.sawKerf)}`;
  return strip.pieces.map((p) => formatNumber(locale, p.length)).join(` + ${kerf} + `);
}

/** Consecutive pieces with the same name collapse to "name × n". */
export function pieceList(locale: Locale, strip: Strip): string[] {
  const runs: { name: string; length: number; width: number; count: number }[] = [];
  for (const piece of strip.pieces) {
    const last = runs[runs.length - 1];
    if (last && last.name === piece.name && last.length === piece.length && last.width === piece.width) last.count++;
    else runs.push({ ...piece, count: 1 });
  }
  return runs.map(({ name, length, width, count }) =>
    [
      name,
      formatNumber(locale, length),
      count > 1 ? `× ${count}` : '',
      width < strip.stripWidth
        ? `(${t(locale, 'preview.ripTo', { w: formatNumber(locale, width) })})`
        : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
}
