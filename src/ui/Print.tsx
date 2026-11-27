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
  mono,
  onMonoChange,
}: {
  locale: Locale;
  selected: PrintSection[];
  onChange: (selected: PrintSection[]) => void;
  mono: boolean;
  onMonoChange: (mono: boolean) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 p-3">
      <legend className="sr-only">{t(locale, 'print.title')}</legend>
      {PRINT_SECTIONS.map((id) => (
        <label key={id} className="check">
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
      <label className="check border-l border-slate-300 pl-4 font-medium">
        <input
          type="checkbox"
          checked={mono}
          onChange={(event) => onMonoChange(event.target.checked)}
        />
        {t(locale, 'print.mono')}
      </label>
      <button
        type="button"
        className="btn btn-primary ml-auto"
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
  mono,
  who,
  boards,
  strips,
}: {
  locale: Locale;
  settings: Settings;
  result: Result;
  selected: PrintSection[];
  mono: boolean;
  who: () => ReactNode;
  boards: (heading: ReactNode) => ReactNode;
  strips: (heading: ReactNode) => ReactNode;
}) {
  return (
    <div
      className={`hidden print:block ${mono ? 'mono' : ''}`}
      aria-hidden="true"
      data-testid="print-sheet"
    >
      {selected.map((id) => {
        const heading = <h2 className="text-lg font-semibold">{t(locale, LABELS[id])}</h2>;
        // Drawing sections span pages; they keep their heading with the first drawing.
        if (id === 'boards' || id === 'strips') {
          return (
            <section key={id} className="not-first:mt-6">
              {id === 'boards' ? boards(heading) : strips(heading)}
            </section>
          );
        }
        // Shorter sections move to the next page whole when they do not fit.
        return (
          <section key={id} className="break-inside-avoid not-first:mt-6">
            {heading}
            {id === 'who' ? (
              who()
            ) : (
              <DataTable locale={locale} table={buildTable(id, result, settings, locale)} />
            )}
          </section>
        );
      })}
    </div>
  );
}
