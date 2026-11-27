import { useId } from 'react';
import type { Settings, Strip } from '../core/types';
import { t, type Locale } from '../i18n';
import { Hatch, Piece } from './drawing';
import { cutSequence, edgeName, formatNumber, materialName, pieceList } from './format';

interface Props {
  locale: Locale;
  settings: Settings;
  strip: Strip;
  /** Matches the number on the board drawing. */
  number: number;
  withPieceList?: boolean;
}

/** Narrow strips are drawn taller than scale so their labels stay readable. */
const MIN_DRAWN_WIDTH = 180;

/** One strip with its pieces. Drawn on the board length, so strips compare by eye. */
export function StripView({ locale, settings, strip, number, withPieceList }: Props) {
  const hatch = useId();
  const height = Math.max(strip.stripWidth, MIN_DRAWN_WIDTH);
  const mm = (value: number) => formatNumber(locale, value);
  let position = 0;
  const heading = [
    t(locale, 'strip.number', { n: number }),
    materialName(locale, strip.material),
    `${t(locale, 'column.width')} ${mm(strip.stripWidth)}`,
    `${t(locale, 'column.length')} ${formatNumber(locale, strip.orderLength, settings.orderDecimals)}`,
    strip.edgeL1 === undefined
      ? t(locale, 'tab.unbanded')
      : `L1: ${edgeName(locale, settings, strip.edgeL1)}`,
    strip.edgeL2 === undefined ? '' : `L2: ${edgeName(locale, settings, strip.edgeL2)}`,
    ...strip.flags.map((flag) => t(locale, `flag.${flag}`)),
  ];

  return (
    <article className="break-inside-avoid py-2">
      <p className="text-sm font-medium">{heading.filter(Boolean).join(' · ')}</p>
      <svg viewBox={`-4 -4 ${settings.maxLength + 8} ${height + 8}`} width="100%">
        <defs>
          <Hatch id={hatch} />
        </defs>
        {/* Everything not covered by a part is offcut. */}
        <rect width={strip.orderLength} height={height} fill={`url(#${hatch})`} stroke="#111827" strokeWidth="5" />
        {strip.pieces.map((piece, i) => {
          const x = position;
          position += piece.length + settings.sawKerf;
          return (
            <Piece
              key={i}
              x={x}
              length={piece.length}
              height={height}
              name={piece.name}
              lengthText={mm(piece.length)}
              widthText={mm(strip.stripWidth)}
              banded={strip.edgeL2 !== undefined ? 2 : strip.edgeL1 !== undefined ? 1 : 0}
            />
          );
        })}
      </svg>
      <p className="text-sm">
        {cutSequence(locale, strip, settings)} · {t(locale, 'preview.offcut')} {mm(strip.offcut)}
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
