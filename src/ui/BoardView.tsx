import { useId } from 'react';
import { boardStats, type Board } from '../core/boards';
import { boardSize } from '../core/settings';
import type { Settings, Strip } from '../core/types';
import { t, type Locale } from '../i18n';
import { Hatch, Piece } from './drawing';
import { formatNumber, materialName } from './format';

interface Props {
  locale: Locale;
  settings: Settings;
  board: Board;
  number: number;
  total: number;
  strips: Strip[];
}

/** A whole board to scale, with the strips ripped from it and their parts. */
export function BoardView({ locale, settings, board, number, total, strips }: Props) {
  const hatch = useId();
  const mm = (value: number) => formatNumber(locale, value, 1);
  const { sawKerf } = settings;
  const { length: maxLength, width: maxWidth } = boardSize(settings, board.crossCut);
  const stats = boardStats(board, strips, settings);
  const footer = [
    materialName(locale, board.material),
    board.thickness === null ? '' : `${mm(board.thickness)} mm`,
    t(locale, 'boards.board', { n: number, total }),
    `${mm(maxLength)} × ${mm(maxWidth)} mm`,
    board.crossCut ? t(locale, 'flag.acrossGrain') : '',
    `${t(locale, 'boards.waste')}: ${formatNumber(locale, stats.wastePercent, 1)} %`,
    `${t(locale, 'boards.cuts')}: ${stats.cuts} (${formatNumber(locale, stats.cutLength / 1000, 2)} m)`,
  ];

  return (
    <figure
      className={`${board.crossCut ? 'max-w-2xl' : 'max-w-4xl'} break-inside-avoid py-3`}
    >
      <svg viewBox={`-4 -4 ${maxLength + 8} ${maxWidth + 8}`} width="100%">
        <defs>
          <Hatch id={hatch} />
        </defs>
        {/* Everything not covered by a part is waste. */}
        <rect width={maxLength} height={maxWidth} fill={`url(#${hatch})`} stroke="#111827" strokeWidth="8" />
        {stats.offcuts.map((offcut, i) => {
          const font = Math.min(44, offcut.width * 0.8);
          if (font < 28 || offcut.length < 500) return null;
          return (
            <text
              key={i}
              x={offcut.x + offcut.length - 14}
              y={offcut.y + offcut.width / 2 + font / 3}
              fontSize={font}
              textAnchor="end"
            >
              {t(locale, 'boards.waste')} {mm(offcut.length)} × {mm(offcut.width)}
            </text>
          );
        })}
        {board.strips.map((placed) => {
          const strip = strips[placed.strip]!;
          const banded = strip.edgeL2 !== undefined ? 2 : strip.edgeL1 !== undefined ? 1 : 0;
          let position = 0;
          return (
            <g key={placed.strip} transform={`translate(${placed.x} ${placed.y})`}>
              {strip.pieces.map((piece, i) => {
                const x = position;
                position += piece.length + sawKerf;
                return (
                  <Piece
                    key={i}
                    x={x}
                    length={piece.length}
                    height={placed.width}
                    name={`#${placed.strip + 1} ${piece.name}`.trim()}
                    lengthText={mm(piece.length)}
                    widthText={mm(strip.stripWidth)}
                    banded={banded}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-center text-sm">{footer.filter(Boolean).join(' · ')}</figcaption>
    </figure>
  );
}
