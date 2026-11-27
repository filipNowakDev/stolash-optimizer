import { WHOLE_REASONS } from '../core/banding';
import type { Result } from '../core/job';
import type { Part, PartException, Settings } from '../core/types';
import { t, type Locale } from '../i18n';
import { Banding } from './drawing';
import { edgeName, formatNumber, materialName } from './format';

const quantity = (items: PartException[]) => items.reduce((sum, e) => sum + e.part.quantity, 0);

/** What goes to the wholesaler and what is cut in the shop. */
export function WhoDoesWhat({
  locale,
  settings,
  result,
}: {
  locale: Locale;
  settings: Settings;
  result: Result;
}) {
  const whole = result.exceptions.filter((e) => WHOLE_REASONS.includes(e.reason));
  const rest = result.exceptions.filter((e) => !WHOLE_REASONS.includes(e.reason));
  const strips = result.rows.reduce((sum, row) => sum + row.quantity, 0);
  const pieces = result.strips.reduce((sum, strip) => sum + strip.pieces.length, 0);
  const rips = result.strips.filter((s) => s.flags.includes('doubled')).length / 2;
  const mm = (value: number) => formatNumber(locale, value, 1);
  const describe = ({ part }: PartException) =>
    [
      part.name,
      `${mm(part.length)} × ${mm(part.width)}`,
      materialName(locale, part.material),
      `× ${part.quantity}`,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <div className="flex flex-col gap-2 py-2">
      <p>
        <strong>{t(locale, 'who.wholesaler')}:</strong>{' '}
        {t(locale, 'who.ordered', { strips, whole: quantity(whole) })}
      </p>
      <p>
        <strong>{t(locale, 'who.you')}:</strong> {t(locale, 'who.cut', { pieces, rips })}
      </p>
      {result.banding.length > 0 && (
        <div>
          <p>
            <strong>{t(locale, 'banding.total')}:</strong>{' '}
            {formatNumber(locale, result.metrics.banding / 1000, 2)} m
          </p>
          <ul className="list-disc pl-5 text-sm">
            {result.banding.map(({ label, strips, whole }) => (
              <li key={label ?? ''}>
                {t(locale, 'banding.product', {
                  name: edgeName(locale, settings, label),
                  total: formatNumber(locale, (strips + whole) / 1000, 2),
                  strips: formatNumber(locale, strips / 1000, 2),
                  whole: formatNumber(locale, whole / 1000, 2),
                })}
              </li>
            ))}
          </ul>
          <p className="muted">{t(locale, 'banding.note')}</p>
        </div>
      )}
      {whole.length > 0 && (
        <>
          <h3 className="font-semibold">{t(locale, 'who.whole')}</h3>
          <div className="flex flex-wrap gap-4">
            {whole.map((item, i) => (
              <figure key={i} className="w-56 break-inside-avoid">
                <ElementDrawing part={item.part} longest={settings.maxLength} />
                <figcaption className="text-sm">{describe(item)}</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
      {rest.length > 0 && (
        <>
          <h3 className="font-semibold text-red-700">{t(locale, 'who.uncovered')}</h3>
          <ul className="list-disc pl-5 text-sm">
            {rest.map((item, i) => (
              <li key={i}>
                {describe(item)}: {t(locale, `reason.${item.reason}`)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** A whole element with its length horizontal and a wavy line on each banded side. */
function ElementDrawing({ part, longest }: { part: Part; longest: number }) {
  const { length, width, edges } = part;
  const size = Math.max(length, width, longest / 4);
  return (
    <svg viewBox={`-20 -20 ${size + 40} ${width + 40}`} width="100%">
      <rect className="piece" width={length} height={width} fill="#fce5cd" stroke="#111827" strokeWidth="8" />
      {edges.left && <Banding length={length} y={width - 20} />}
      {edges.right && <Banding length={length} y={20} />}
      {edges.top && (
        <g transform="translate(20 0) rotate(90)">
          <Banding length={width} y={0} />
        </g>
      )}
      {edges.bottom && (
        <g transform={`translate(${length - 20} 0) rotate(90)`}>
          <Banding length={width} y={0} />
        </g>
      )}
    </svg>
  );
}
