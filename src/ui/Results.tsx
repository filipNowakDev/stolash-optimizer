import { useState } from 'react';
import type { Result } from '../core/job';
import type { SkippedRow } from '../core/parse';
import { canDouble } from '../core/order';
import type { Settings, Strip } from '../core/types';
import { t, type Locale } from '../i18n';
import { BoardView } from './BoardView';
import { DataTable } from './DataTable';
import { downloadCsv, downloadXlsx, toTsv } from './export';
import { formatNumber, materialName } from './format';
import { PrintPanel, PrintSheet, PRINT_SECTIONS, type PrintSection } from './Print';
import { StripView } from './StripView';
import { Tabs } from './Tabs';
import { WhoDoesWhat } from './WhoDoesWhat';
import { buildTable, type TableId } from './tables';

type Tab = TableId | 'map' | 'strips';
const TABS: Tab[] = ['order', 'finished', 'unbanded', 'map', 'strips'];

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
  const [printed, setPrinted] = useState<PrintSection[]>([...PRINT_SECTIONS]);
  // Strip width can only be non-positive after classification, so it is listed here too.
  const tooThin = result.exceptions.filter((e) => e.reason === 'nonPositiveWidth');
  const skippedCount = skipped.length + tooThin.length;
  // Pairing needs two full-length strips of a group.
  const groups = new Map<string, Strip[]>();
  for (const strip of result.strips) {
    if (canDouble(strip, settings) && !strip.flags.includes('short')) {
      groups.set(strip.groupKey, [...(groups.get(strip.groupKey) ?? []), strip]);
    }
  }
  const pairable = [...groups].filter(([, strips]) => strips.length >= 2);

  const who = () => <WhoDoesWhat locale={locale} settings={settings} result={result} />;

  const legend = (
    <p className="flex flex-wrap gap-4 text-sm">
      <span>
        <span aria-hidden="true">﹏﹏ </span>
        {t(locale, 'boards.edgeBanding')}
      </span>
      <span>
        <span aria-hidden="true" className="font-bold text-blue-700">━━ </span>
        {t(locale, 'who.legendOrdered')}
      </span>
      <span>
        <span aria-hidden="true" className="font-bold text-red-600">╍╍ </span>
        {t(locale, 'who.legendCut')}
      </span>
    </p>
  );

  const boards = () => (
    <>
      <h3 className="pt-2 font-semibold">
        {t(locale, 'boards.title', { n: result.boards.length })} ·{' '}
        {t(locale, 'who.wholesalerCuts')}: {formatNumber(locale, result.cutLength / 1000, 2)} m
      </h3>
      <p className="text-sm">{t(locale, 'boards.note')}</p>
      {legend}
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
    </>
  );

  const strips = () => (
    <>
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
      <div className="card print:hidden">
        {skippedCount > 0 && (
          <details className="rounded-lg bg-amber-50 p-3 text-amber-800">
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

        {!result.proven && <p className="text-amber-700">{t(locale, 'preview.notProven')}</p>}

        {pairable.length > 0 && (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 font-semibold">{t(locale, 'preview.pair')}</legend>
            {pairable.map(([key, [strip, ...others]]) => (
              <label key={key} className="check">
                <input
                  type="checkbox"
                  checked={doubled[key] ?? false}
                  onChange={(event) => onDoubledChange({ ...doubled, [key]: event.target.checked })}
                />
                {[
                  materialName(locale, strip!.material),
                  `${t(locale, 'column.width')} ${formatNumber(locale, strip!.stripWidth)}`,
                  strip!.thickness === null ? '' : `${formatNumber(locale, strip!.thickness)} mm`,
                  strip!.crossCut ? t(locale, 'flag.acrossGrain') : '',
                  `× ${others.length + 1}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </label>
            ))}
          </fieldset>
        )}

        <PrintPanel locale={locale} selected={printed} onChange={setPrinted} />

        <Tabs
          testId="results-panel"
          active={tab}
          onChange={setTab}
          tabs={TABS.map((id) => ({
            id,
            label: t(locale, `tab.${id}`),
            content: () =>
              id === 'map' ? (
                <>
                  {who()}
                  {boards()}
                </>
              ) : id === 'strips' ? (
                <>
                  {legend}
                  {strips()}
                </>
              ) : (
                <TableTab key={id} id={id} locale={locale} settings={settings} result={result} />
              ),
          }))}
        />
      </div>

      <PrintSheet
        locale={locale}
        settings={settings}
        result={result}
        selected={printed}
        who={who}
        boards={boards}
        strips={strips}
      />
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
      {id === 'unbanded' && <p className="muted">{t(locale, 'unbanded.note')}</p>}
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
        <DataTable locale={locale} table={table} />
      </div>
      {table.rows.length === 0 && <p>{t(locale, 'results.empty')}</p>}
    </div>
  );
}
