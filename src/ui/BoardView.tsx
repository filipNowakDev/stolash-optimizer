import { useId } from 'react';
import { boardStats, type Board } from '../core/boards';
import type { Settings, Strip } from '../core/types';
import { t, type Locale } from '../i18n';
import { crossCuts, Hatch, Ordered, OwnCut, Piece } from './drawing';
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
  const { maxLength, maxWidth, sawKerf } = settings;
  const stats = boardStats(board, strips, settings);
  const meters = (value: number) => formatNumber(locale, value / 1000, 2);
  const footer = [
    materialName(locale, board.material),
    board.thickness === null ? '' : `${mm(board.thickness)} mm`,
    t(locale, 'boards.board', { n: number, total }),
    `${mm(maxLength)} × ${mm(maxWidth)} mm`,
    `${t(locale, 'boards.waste')}: ${formatNumber(locale, stats.wastePercent, 1)} %`,
    `${t(locale, 'who.wholesalerCuts')}: ${board.cuts} (${meters(board.cutLength)} m)`,
    `${t(locale, 'who.yourCuts')}: ${stats.own} (${meters(stats.ownLength)} m)`,
  ];

  return (
    <figure className="max-w-4xl break-inside-avoid py-3">
      <svg viewBox={`-4 -4 ${maxLength + 8} ${maxWidth + 8}`} width="100%">
        <defs>
          <Hatch id={hatch} />
        </defs>
        {/* Everything not covered by a part is waste. */}
        <rect width={maxLength} height={maxWidth} fill={`url(#${hatch})`} stroke="#111827" strokeWidth="8" />
        {stats.offcuts.map((offcut, i) => {
          const font = Math.min(44, offcut.dy * 0.8);
          if (font < 28 || offcut.dx < 500) return null;
          return (
            <text
              key={i}
              x={offcut.x + offcut.dx - 14}
              y={offcut.y + offcut.dy / 2 + font / 3}
              fontSize={font}
              textAnchor="end"
            >
              {t(locale, 'boards.waste')} {mm(offcut.dx)} × {mm(offcut.dy)}
            </text>
          );
        })}
        {board.blanks.map((blank) => (
          // Drawn along the strip; an across-grain one is turned a quarter.
          <g
            key={blank.strips[0]}
            transform={
              blank.turned
                ? `translate(${blank.x + blank.width} ${blank.y}) rotate(90)`
                : `translate(${blank.x} ${blank.y})`
            }
          >
            {blank.strips.map((index, half) => {
              const strip = strips[index]!;
              const banded = strip.edgeL2 !== undefined ? 2 : strip.edgeL1 !== undefined ? 1 : 0;
              let position = 0;
              return (
                <g key={index} transform={`translate(0 ${half * (strip.stripWidth + sawKerf)})`}>
                  {strip.pieces.map((piece, i) => {
                    const x = position;
                    position += piece.length + sawKerf;
                    const y = strip.stripWidth - piece.width;
                    return (
                      <g key={i}>
                        <Piece
                          x={x}
                          y={y}
                          length={piece.length}
                          height={piece.width}
                          name={`#${index + 1} ${piece.name}`.trim()}
                          lengthText={mm(piece.length)}
                          widthText={mm(piece.width)}
                          banded={banded}
                        />
                        {y > 0 && <OwnCut x1={x} y1={y} x2={x + piece.length} y2={y} />}
                      </g>
                    );
                  })}
                </g>
              );
            })}
            <Ordered length={blank.length} height={blank.width} />
            {blank.strips.length === 2 && (
              <OwnCut x1={0} y1={blank.width / 2} x2={blank.length} y2={blank.width / 2} />
            )}
            {blank.strips.map((index, half) => {
              const strip = strips[index]!;
              const top = half * (strip.stripWidth + sawKerf);
              return crossCuts(strip.pieces, sawKerf, blank.length).map((x) => (
                <OwnCut key={`${index}-${x}`} x1={x} y1={top} x2={x} y2={top + strip.stripWidth} />
              ));
            })}
          </g>
        ))}
      </svg>
      <figcaption className="text-center text-sm">{footer.filter(Boolean).join(' · ')}</figcaption>
    </figure>
  );
}
