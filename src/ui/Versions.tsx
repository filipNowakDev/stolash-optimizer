import { useState } from 'react';
import type { Result } from '../core/job';
import { t, type Locale, type MessageId } from '../i18n';
import { formatNumber } from './format';

const COLUMNS: { id: MessageId; value: (r: Result) => number; text: (l: Locale, r: Result) => string; best: 'min' | 'max' }[] = [
  { id: 'versions.boards', best: 'min', value: (r) => r.metrics.boards, text: (_, r) => String(r.metrics.boards) },
  { id: 'versions.cuts', best: 'min', value: (r) => r.metrics.cutLength, text: (l, r) => formatNumber(l, r.metrics.cutLength / 1000, 2) },
  { id: 'versions.ownCuts', best: 'min', value: (r) => r.metrics.ownLength, text: (l, r) => formatNumber(l, r.metrics.ownLength / 1000, 2) },
  { id: 'versions.waste', best: 'min', value: (r) => r.metrics.waste, text: (l, r) => formatNumber(l, r.metrics.waste / 1e6, 2) },
  { id: 'versions.reusable', best: 'max', value: (r) => r.metrics.reusable, text: (l, r) => formatNumber(l, r.metrics.reusable / 1e6, 2) },
  {
    id: 'versions.largest',
    best: 'max',
    value: (r) => (r.metrics.largest ? r.metrics.largest.dx * r.metrics.largest.dy : 0),
    text: (l, r) =>
      r.metrics.largest
        ? `${formatNumber(l, r.metrics.largest.dx, 0)} × ${formatNumber(l, r.metrics.largest.dy, 0)}`
        : '—',
  },
];

interface Props {
  locale: Locale;
  versions: Result[];
  selected: string;
  onSelect: (id: string) => void;
}

/** One row per way of cutting; click a column to sort, best first. */
export function Versions({ locale, versions, selected, onSelect }: Props) {
  const [sort, setSort] = useState<number | null>(null);
  const column = sort === null ? null : COLUMNS[sort]!;
  const rows = column
    ? [...versions].sort(
        (a, b) => (column.value(a) - column.value(b)) * (column.best === 'min' ? 1 : -1),
      )
    : versions;
  const name = (version: Result) =>
    version.short
      ? t(locale, 'versions.goal.short')
      : version.goals.length > 0
      ? version.goals.map((goal) => t(locale, `versions.goal.${goal}`)).join(', ')
      : t(locale, 'versions.goal.other');

  return (
    <fieldset className="overflow-x-auto">
      <legend className="font-semibold">{t(locale, 'versions.title')}</legend>
      <table className="data">
        <thead>
          <tr>
            <th>{t(locale, 'versions.version')}</th>
            {COLUMNS.map(({ id, best }, i) => (
              <th key={id} aria-sort={sort === i ? (best === 'min' ? 'ascending' : 'descending') : undefined}>
                <button type="button" className="cursor-pointer underline" onClick={() => setSort(i)}>
                  {t(locale, id)}
                </button>
                {sort === i && (best === 'min' ? ' ▲' : ' ▼')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((version) => (
            <tr key={version.id} className={version.id === selected ? 'bg-blue-50' : undefined}>
              <td>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="version"
                    checked={version.id === selected}
                    onChange={() => onSelect(version.id)}
                  />
                  {version.number}. {name(version)}
                </label>
              </td>
              {COLUMNS.map(({ id, text }) => (
                <td key={id}>{text(locale, version)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {versions.length < 3 && <p className="text-sm">{t(locale, 'versions.few')}</p>}
    </fieldset>
  );
}
