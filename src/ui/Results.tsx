import { useState } from 'react';
import type { Result } from '../core/job';
import type { SkippedRow } from '../core/parse';
import { canDouble } from '../core/order';
import type { Settings } from '../core/types';
import { t, type Locale } from '../i18n';
import { BoardView } from './BoardView';
import { downloadCsv, downloadXlsx, toTsv } from './export';
import { formatNumber } from './format';
import { StripView } from './StripView';
import { buildTable, type TableId } from './tables';

type Tab = TableId | 'map';
const TABS: Tab[] = ['order', 'finished', 'unbanded', 'map'];

interface Props {
  locale: Locale;
  settings: Settings;
  result: Result;
  skipped: SkippedRow[];
  doubled: Record<string, boolean>;
  onDoubledChange: (doubled: Record<string, boolean>) => void;
}

export function Results({ locale, settings, result, skipped, doubled, onDoubledChange }: Props) {
  const [tab, setTab] = useState<Tab>('order');
  // Strip width can only be non-positive after classification, so it is listed here too.
  const tooThin = result.exceptions.filter((e) => e.reason === 'nonPositiveWidth');
  const skippedCount = skipped.length + tooThin.length;
  const offered = new Set<string>();
  // Pairing needs two full-length strips of a group.
  const fullStrips = new Map<string, number>();
  for (const strip of result.strips) {
    if (!strip.flags.includes('short')) {
      fullStrips.set(strip.groupKey, (fullStrips.get(strip.groupKey) ?? 0) + 1);
    }
  }

  const cutMap = () => (
    <>
      <h3 className="pt-2 font-semibold">
        {t(locale, 'boards.title', { n: result.boards.length })}
      </h3>
      <p className="text-sm">{t(locale, 'boards.note')}</p>
      <p className="text-sm">
        <span aria-hidden="true">﹏﹏ </span>
        {t(locale, 'boards.edgeBanding')}
      </p>
      {result.boards.map((board, i) => (
        <BoardView
          key={i}
          locale={locale}
          settings={settings}
          board={board}
          number={i + 1}
          total={result.boards.length}
          strips={result.strips}
        />
      ))}
      <h3 className="pt-2 font-semibold">{t(locale, 'preview.title')}</h3>
      {result.strips.map((strip, i) => (
        <StripView
          key={i}
          locale={locale}
          settings={settings}
          strip={strip}
          number={i + 1}
          withPieceList
        />
      ))}
    </>
  );

  return (
    <>
      <div className="flex flex-col gap-4 print:hidden">
        {skippedCount > 0 && (
          <details className="rounded border border-amber-600 p-2">
            <summary>{t(locale, 'results.skipped', { n: skippedCount })}</summary>
            <ul className="text-sm">
              {skipped.map((row) => (
                <li key={row.row}>
                  {t(locale, 'results.row', { n: row.row })}: {t(locale, `reason.${row.reason}`)} (
                  {row.text})
                </li>
              ))}
              {tooThin.map(({ part }, i) => (
                <li key={`thin-${i}`}>
                  {part.name} {formatNumber(locale, part.length)} ×{' '}
                  {formatNumber(locale, part.width)}: {t(locale, 'reason.nonPositiveWidth')}
                </li>
              ))}
            </ul>
          </details>
        )}

        <section>
          <h2 className="text-lg font-semibold">{t(locale, 'preview.title')}</h2>
          {!result.proven && <p className="text-amber-700">{t(locale, 'preview.notProven')}</p>}
          {result.strips.length === 0 && <p>{t(locale, 'results.empty')}</p>}
          {result.strips.map((strip, i) => {
            const offerPair =
              canDouble(strip, settings) &&
              (fullStrips.get(strip.groupKey) ?? 0) >= 2 &&
              !offered.has(strip.groupKey);
            if (offerPair) offered.add(strip.groupKey);
            return (
              <div key={i}>
                {offerPair && (
                  <label className="flex items-center gap-1 pt-2">
                    <input
                      type="checkbox"
                      checked={doubled[strip.groupKey] ?? false}
                      onChange={(event) =>
                        onDoubledChange({ ...doubled, [strip.groupKey]: event.target.checked })
                      }
                    />
                    {t(locale, 'preview.pair')}
                  </label>
                )}
                <StripView locale={locale} settings={settings} strip={strip} number={i + 1} />
              </div>
            );
          })}
        </section>

        <section>
          <div role="tablist" className="flex gap-1 border-b">
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className="rounded-t border border-b-0 px-3 py-1 aria-selected:bg-gray-200 aria-selected:font-semibold"
                onClick={() => setTab(id)}
              >
                {t(locale, `tab.${id}`)}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="py-2">
            {tab === 'map' ? (
              <>
                <button type="button" className="btn" onClick={() => window.print()}>
                  {t(locale, 'action.print')}
                </button>
                {cutMap()}
              </>
            ) : (
              <TableTab key={tab} id={tab} locale={locale} settings={settings} result={result} />
            )}
          </div>
        </section>
      </div>

      {/* The print layout is the cut map only, whichever tab is open. */}
      <div className="hidden print:block">
        <h1 className="text-lg font-semibold">{t(locale, 'tab.map')}</h1>
        {cutMap()}
      </div>
    </>
  );
}

function TableTab({
  id,
  locale,
  settings,
  result,
}: {
  id: TableId;
  locale: Locale;
  settings: Settings;
  result: Result;
}) {
  const [copy, setCopy] = useState<'copy' | 'copied' | 'copyFailed'>('copy');
  const table = buildTable(id, result, settings, locale);

  return (
    <div className="flex flex-col items-start gap-2">
      {id === 'unbanded' && <p className="text-sm">{t(locale, 'unbanded.note')}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn"
          onClick={() =>
            navigator.clipboard.writeText(toTsv(table, locale)).then(
              () => setCopy('copied'),
              () => setCopy('copyFailed'),
            )
          }
        >
          {t(locale, `action.${copy}`)}
        </button>
        <button type="button" className="btn" onClick={() => downloadCsv(table, locale)}>
          {t(locale, 'action.csv')}
        </button>
        <button type="button" className="btn" onClick={() => void downloadXlsx(table)}>
          {t(locale, 'action.xlsx')}
        </button>
      </div>
      <div className="w-full overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              {table.headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>
                    {typeof cell === 'number' ? formatNumber(locale, cell) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.rows.length === 0 && <p>{t(locale, 'results.empty')}</p>}
    </div>
  );
}
