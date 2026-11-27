import type { Settings, Strip } from '../core/types';
import { t, type Locale } from '../i18n';
import { cutSequence, edgeName, formatNumber, materialName, pieceList } from './format';

interface Props {
  locale: Locale;
  settings: Settings;
  strip: Strip;
  withPieceList?: boolean;
}

/** One strip drawn to scale of its order length. */
export function StripView({ locale, settings, strip, withPieceList }: Props) {
  const percent = (mm: number) => `${(mm / strip.orderLength) * 100}%`;
  let position = 0;
  const heading = [
    materialName(locale, strip.material),
    `${t(locale, 'column.width')} ${formatNumber(locale, strip.stripWidth)}`,
    `${t(locale, 'column.length')} ${formatNumber(locale, strip.orderLength, settings.orderDecimals)}`,
    `L1: ${edgeName(locale, settings, strip.edgeL1)}`,
    strip.edgeL2 === undefined ? '' : `L2: ${edgeName(locale, settings, strip.edgeL2)}`,
    ...strip.flags.map((flag) => t(locale, `flag.${flag}`)),
  ];

  return (
    <article className="break-inside-avoid py-2">
      <p className="text-sm font-medium">{heading.filter(Boolean).join(' · ')}</p>
      <svg width="100%" height="32" className="border border-gray-500">
        {strip.pieces.map((piece, i) => {
          const x = position;
          position += piece.length + settings.sawKerf;
          return (
            <svg key={i} x={percent(x)} width={percent(piece.length)} height="32">
              <title>{`${piece.name} ${formatNumber(locale, piece.length)}`.trim()}</title>
              <rect width="100%" height="100%" fill="#dbeafe" stroke="#1e3a8a" />
              <text x="4" y="21" fontSize="12">
                {piece.name || formatNumber(locale, piece.length)}
              </text>
            </svg>
          );
        })}
      </svg>
      <p className="text-sm">
        {cutSequence(locale, strip, settings)} · {t(locale, 'preview.offcut')}{' '}
        {formatNumber(locale, strip.offcut)}
      </p>
      {withPieceList && (
        <ul className="list-disc pl-5 text-sm">
          {pieceList(locale, strip).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      {strip.flags.includes('doubled') && (
        <p className="text-sm font-semibold">{t(locale, 'note.doubled')}</p>
      )}
    </article>
  );
}
