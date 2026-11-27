import { useMemo, useState } from 'react';
import {
  decodeFile,
  isMapComplete,
  normalize,
  parseRows,
  proposeMap,
  readTable,
  ROLES,
  type ColumnMap,
  type EdgeMode,
  type Encoding,
  type Role,
  type SkippedRow,
  type Table,
} from '../core/parse';
import type { Edge, Part } from '../core/types';
import { t, type Locale } from '../i18n';
import { Materials, suggestedGrain } from './Materials';

export interface Imported {
  parts: Part[];
  skipped: SkippedRow[];
  grainLock: Record<string, boolean>;
  map: ColumnMap;
}

interface Draft {
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

interface Props {
  locale: Locale;
  storedMap: () => ColumnMap | null;
  onImport: (imported: Imported) => void;
}

export function ImportPanel({ locale, storedMap, onImport }: Props) {
  const [paste, setPaste] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [empty, setEmpty] = useState(false);
  const [grain, setGrain] = useState<Record<string, boolean>>({});

  const load = (text: string, encoding: Encoding | null) => {
    const table = readTable(text);
    setEmpty(table.rows.length === 0);
    setGrain({});
    setDraft(
      table.rows.length === 0 ? null : { table, encoding, ...proposeMap(table, storedMap()) },
    );
  };

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    const { text, encoding } = decodeFile(await file.arrayBuffer());
    load(text, encoding);
  };

  const parsed = useMemo(
    () => (draft && isMapComplete(draft.map) ? parseRows(draft.table, draft.map) : null),
    [draft],
  );
  const grainLock = parsed ? suggestedGrain(parsed.parts, grain) : {};

  const setMap = (change: Partial<ColumnMap>) =>
    setDraft((d) => d && { ...d, map: { ...d.map, ...change } });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{t(locale, 'import.title')}</h2>
      <div className="flex flex-col gap-3 lg:flex-row">
        <label
          className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded border-2 border-dashed p-8"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void loadFile(event.dataTransfer.files[0]);
          }}
        >
          {t(locale, 'import.drop')}
          <input
            type="file"
            accept=".csv,.txt"
            className="sr-only"
            onChange={(event) => {
              void loadFile(event.target.files?.[0]);
              // Lets the same file be chosen again.
              event.target.value = '';
            }}
          />
        </label>
        <div className="flex flex-1 flex-col items-start gap-2">
          <textarea
            className="h-24 w-full rounded border p-2 font-mono text-sm"
            aria-label={t(locale, 'import.paste')}
            placeholder={t(locale, 'import.pastePlaceholder')}
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
          />
          <button type="button" className="btn" onClick={() => load(paste, null)}>
            {t(locale, 'import.load')}
          </button>
        </div>
      </div>
      {empty && <p className="text-red-700">{t(locale, 'import.empty')}</p>}

      {draft && (
        <div className="flex flex-col gap-3 rounded border p-3">
          <p className="text-sm">
            {t(locale, 'import.encoding')}: {draft.encoding ?? t(locale, 'import.clipboard')} ·{' '}
            {t(locale, 'import.delimiter')}:{' '}
            {draft.table.delimiter === '\t' ? t(locale, 'import.tab') : draft.table.delimiter} ·{' '}
            {t(locale, 'import.rows')}: {draft.table.rows.length}
            {draft.formatek && <strong> · {t(locale, 'import.profile')}</strong>}
          </p>

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
                  className="rounded border"
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
                      className="rounded border"
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

          {parsed ? (
            <>
              <Materials
                locale={locale}
                parts={parsed.parts}
                grainLock={grainLock}
                onChange={setGrain}
              />
              {parsed.skipped.length > 0 && (
                <p>{t(locale, 'results.skipped', { n: parsed.skipped.length })}</p>
              )}
            </>
          ) : (
            <p className="text-red-700">{t(locale, 'import.incomplete')}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="btn font-semibold"
              disabled={!parsed}
              onClick={() => {
                onImport({ ...parsed!, grainLock, map: draft.map });
                setDraft(null);
                setPaste('');
              }}
            >
              {t(locale, 'import.confirm')}
            </button>
            <button type="button" className="btn" onClick={() => setDraft(null)}>
              {t(locale, 'import.cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
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
    <table className="data self-start">
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
