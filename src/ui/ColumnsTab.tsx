import {
  isMapComplete,
  normalize,
  ROLES,
  type ColumnMap,
  type EdgeMode,
  type Encoding,
  type Role,
  type Table,
} from '../core/parse';
import type { Edge } from '../core/types';
import { t, type Locale } from '../i18n';

/** A loaded table and how its columns are read. Not persisted. */
export interface Draft {
  table: Table;
  encoding: Encoding | null;
  map: ColumnMap;
  formatek: boolean;
}

const MODE_ROLES: Record<EdgeMode, Role[]> = {
  marks: ['lengthMark', 'widthMark'],
  four: ['left', 'right', 'top', 'bottom'],
  single: ['edges'],
};
const COMMON: Role[] = ['name', 'material', 'length', 'width', 'thickness', 'quantity'];
const EDGES: Edge[] = ['left', 'right', 'top', 'bottom'];

export function ColumnsTab({
  locale,
  draft,
  onChange,
}: {
  locale: Locale;
  draft: Draft;
  onChange: (map: ColumnMap) => void;
}) {
  const setMap = (change: Partial<ColumnMap>) => onChange({ ...draft.map, ...change });

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="muted">
        {t(locale, 'import.encoding')}: {draft.encoding ?? t(locale, 'import.clipboard')} ·{' '}
        {t(locale, 'import.delimiter')}:{' '}
        {draft.table.delimiter === '\t' ? t(locale, 'import.tab') : draft.table.delimiter}
      </p>
      {!isMapComplete(draft.map) && (
        <p className="text-red-700">{t(locale, 'import.incomplete')}</p>
      )}
          <div className="overflow-x-auto">
            <table className="data">
              <caption className="text-left">{t(locale, 'import.preview')}</caption>
              <tbody>
                {draft.table.rows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="font-semibold">{t(locale, 'import.map')}</legend>
            <div className="flex flex-wrap gap-4">
              <label>
                {t(locale, 'import.mode')}{' '}
                <select
                  className="input"
                  value={draft.map.mode}
                  onChange={(event) => setMap({ mode: event.target.value as EdgeMode })}
                >
                  {(Object.keys(MODE_ROLES) as EdgeMode[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {t(locale, `import.mode.${mode}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={draft.map.hasHeader}
                  onChange={(event) => setMap({ hasHeader: event.target.checked })}
                />
                {t(locale, 'import.hasHeader')}
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {ROLES.filter((r) => [...COMMON, ...MODE_ROLES[draft.map.mode]].includes(r)).map(
                (role) => (
                  <label key={role} className="flex flex-col text-sm">
                    {t(locale, `role.${role}`)}
                    <select
                      className="input"
                      value={draft.map.columns[role] ?? ''}
                      onChange={(event) =>
                        setMap({
                          columns: {
                            ...draft.map.columns,
                            [role]:
                              event.target.value === '' ? undefined : Number(event.target.value),
                          },
                        })
                      }
                    >
                      <option value="">{t(locale, 'import.unmapped')}</option>
                      {draft.table.rows[0]!.map((cell, i) => (
                        <option key={i} value={i}>
                          {t(locale, 'import.column', { n: i + 1 })}
                          {draft.map.hasHeader ? `: ${cell}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ),
              )}
            </div>
          </fieldset>

          {draft.map.mode === 'single' && (
            <EdgeTable locale={locale} draft={draft} onChange={(edgeTable) => setMap({ edgeTable })} />
          )}

    </div>
  );
}

/** Lists the values present in the file, so unknown ones can be given a mask. */
function EdgeTable({
  locale,
  draft,
  onChange,
}: {
  locale: Locale;
  draft: Draft;
  onChange: (table: ColumnMap['edgeTable']) => void;
}) {
  const column = draft.map.columns.edges;
  if (column === undefined) return null;
  const rows = draft.table.rows.slice(draft.map.hasHeader ? 1 : 0);
  const values = [...new Set(rows.map((row) => normalize(row[column] ?? '')))];

  return (
    <table className="data">
      <caption className="text-left font-semibold">{t(locale, 'import.edgeTable')}</caption>
      <thead>
        <tr>
          <th>{t(locale, 'import.edgeValue')}</th>
          {EDGES.map((edge) => (
            <th key={edge}>{t(locale, `edge.${edge}`)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {values.map((value) => {
          const mask = draft.map.edgeTable[value];
          return (
            <tr key={value}>
              <td>
                {value || t(locale, 'import.edgeEmpty')}
                {!mask && ` — ${t(locale, 'reason.unknownEdge')}`}
              </td>
              {EDGES.map((edge) => (
                <td key={edge}>
                  <input
                    type="checkbox"
                    aria-label={`${value} ${t(locale, `edge.${edge}`)}`}
                    checked={mask?.includes(edge) ?? false}
                    onChange={(event) =>
                      onChange({
                        ...draft.map.edgeTable,
                        [value]: EDGES.filter((e) =>
                          e === edge ? event.target.checked : mask?.includes(e),
                        ),
                      })
                    }
                  />
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
