import type { Part } from '../core/types';
import { t, type Locale, type MessageId } from '../i18n';
import { formatNumber, materialName } from './format';
import { describeEdges } from './tables';

interface Props {
  locale: Locale;
  parts: Part[];
  /** Indexes of the parts left out of the cut lists. */
  excluded: number[];
  onChange: (excluded: number[]) => void;
}

const COLUMNS: MessageId[] = [
  'column.name', 'column.material', 'column.length', 'column.width',
  'column.thickness', 'column.quantity', 'column.edges',
];

export function PartSelection({ locale, parts, excluded, onChange }: Props) {
  const out = new Set(excluded);
  const mm = (value: number | null) => (value === null ? '' : formatNumber(locale, value));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" onClick={() => onChange([])}>
          {t(locale, 'parts.all')}
        </button>
        <button type="button" className="btn" onClick={() => onChange(parts.map((_, i) => i))}>
          {t(locale, 'parts.none')}
        </button>
        <span className="muted">
          {t(locale, 'parts.title', { n: parts.length - out.size, total: parts.length })}
        </span>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="data w-full">
          <thead>
            <tr>
              <th>{t(locale, 'parts.include')}</th>
              {COLUMNS.map((id) => (
                <th key={id}>{t(locale, id)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parts.map((part, i) => (
              <tr key={i} className={out.has(i) ? 'text-slate-400' : undefined}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${t(locale, 'parts.include')} ${i + 1} ${part.name}`.trim()}
                    checked={!out.has(i)}
                    onChange={(event) =>
                      onChange(
                        event.target.checked ? excluded.filter((e) => e !== i) : [...excluded, i],
                      )
                    }
                  />
                </td>
                <td>{part.name}</td>
                <td>{materialName(locale, part.material)}</td>
                <td>{mm(part.length)}</td>
                <td>{mm(part.width)}</td>
                <td>{mm(part.thickness)}</td>
                <td>{part.quantity}</td>
                <td>{describeEdges(locale, part)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
