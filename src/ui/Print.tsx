import type { ReactNode } from 'react';
import type { Result } from '../core/job';
import type { Settings } from '../core/types';
import { t, type Locale, type MessageId } from '../i18n';
import { DataTable } from './DataTable';
import { buildTable } from './tables';

export const PRINT_SECTIONS = ['who', 'order', 'finished', 'unbanded', 'boards', 'strips'] as const;
export type PrintSection = (typeof PRINT_SECTIONS)[number];

const LABELS: Record<PrintSection, MessageId> = {
  who: 'who.title',
  order: 'tab.order',
  finished: 'tab.finished',
  unbanded: 'tab.unbanded',
  boards: 'print.boards',
  strips: 'print.strips',
};

export function PrintPanel({
  locale,
  selected,
  onChange,
}: {
  locale: Locale;
  selected: PrintSection[];
  onChange: (selected: PrintSection[]) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-4">
      <legend className="font-semibold">{t(locale, 'print.title')}</legend>
      {PRINT_SECTIONS.map((id) => (
        <label key={id} className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={selected.includes(id)}
            onChange={(event) =>
              onChange(
                PRINT_SECTIONS.filter((s) =>
                  s === id ? event.target.checked : selected.includes(s),
                ),
              )
            }
          />
          {t(locale, LABELS[id])}
        </label>
      ))}
      <button
        type="button"
        className="btn font-semibold"
        disabled={selected.length === 0}
        onClick={() => window.print()}
      >
        {t(locale, 'action.print')}
      </button>
    </fieldset>
  );
}

/** What the printer gets; never shown on screen, so Ctrl+P works too. */
export function PrintSheet({
  locale,
  settings,
  result,
  selected,
  who,
  boards,
  strips,
}: {
  locale: Locale;
  settings: Settings;
  result: Result;
  selected: PrintSection[];
  who: () => ReactNode;
  boards: () => ReactNode;
  strips: () => ReactNode;
}) {
  return (
    <div className="hidden print:block" aria-hidden="true" data-testid="print-sheet">
      {selected.map((id) => (
        <section key={id} className="not-first:break-before-page">
          <h2 className="text-lg font-semibold">{t(locale, LABELS[id])}</h2>
          {id === 'who' ? (
            who()
          ) : id === 'boards' ? (
            boards()
          ) : id === 'strips' ? (
            strips()
          ) : (
            <DataTable locale={locale} table={buildTable(id, result, settings, locale)} />
          )}
        </section>
      ))}
    </div>
  );
}
