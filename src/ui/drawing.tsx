// Shared marks of the cutting schematics.

const PERIOD = 24;
const DEPTH = 11;

/** The wavy line that marks a banded edge, drawn from (0, y) to (length, y). */
export function Banding({ length, y }: { length: number; y: number }) {
  const waves = Math.max(1, Math.round(length / PERIOD));
  const step = length / waves;
  const path = `M0 ${y}` + ` q${step / 4} ${-DEPTH} ${step / 2} 0 t${step / 2} 0`.repeat(waves);
  return <path d={path} fill="none" stroke="#111827" strokeWidth="3" />;
}

/** A cut made in the shop. Dashed, so it survives black and white printing. */
export function OwnCut({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <line className="own-cut" x1={x1} y1={y1} x2={x2} y2={y2} stroke="#dc2626" strokeWidth="14" strokeDasharray="36 22" />
  );
}

/** The outline of what the wholesaler delivers. */
export function Ordered({ y = 0, length, height }: { y?: number; length: number; height: number }) {
  return <rect className="ordered" y={y} width={length} height={height} fill="none" stroke="#1d4ed8" strokeWidth="14" />;
}

/** Where the shop crosscuts a strip of the given order length. */
export function crossCuts(pieces: { length: number }[], kerf: number, orderLength: number) {
  let end = -kerf;
  return pieces.map((p) => (end += p.length + kerf)).filter((x) => x < orderLength - 1e-6);
}

export function Hatch({ id }: { id: string }) {
  return (
    <pattern id={id} width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="30" height="30" fill="#fff" />
      <line className="hatch" y2="30" stroke="#9ca3af" strokeWidth="4" />
    </pattern>
  );
}

interface PieceProps {
  x: number;
  y?: number;
  /** Drawn size. The length runs along the strip. */
  length: number;
  height: number;
  name: string;
  /** Formatted dimensions. */
  lengthText: string;
  widthText: string;
  /** Number of banded long edges: L1 is drawn at the bottom, L2 at the top. */
  banded: 0 | 1 | 2;
}

/** A part: length on top with its edge mark, width on the left, name bottom right. */
export function Piece({ x, y = 0, length, height, name, lengthText, widthText, banded }: PieceProps) {
  const font = Math.min(52, height / 3.4, length / 4.5);
  const mark = ['', '-', '='][banded];
  return (
    <svg x={x} y={y} width={length} height={height}>
      <title>{`${name} ${lengthText} × ${widthText}`.trim()}</title>
      <rect className="piece" width="100%" height="100%" fill={banded ? '#d9ead3' : '#d6deef'} stroke="#111827" strokeWidth="5" />
      {banded > 0 && <Banding length={length} y={height - 14} />}
      {banded === 2 && <Banding length={length} y={14} />}
      {/* Below this the text is unreadable; the title and piece list still have it. */}
      {font >= 22 && (
        <g fontSize={font} fill="#111827">
          <text x={length / 2} y={font + 20} textAnchor="middle">
            {lengthText}
            {mark}
          </text>
          <text x="14" y={height / 2 + font / 3}>
            {widthText}
          </text>
          {/* Long names shrink instead of running off a small part. */}
          <text
            x={length - 14}
            y={height - 26}
            textAnchor="end"
            fontSize={Math.min(font, (length - 28) / (name.length * 0.55))}
          >
            {name}
          </text>
        </g>
      )}
    </svg>
  );
}
