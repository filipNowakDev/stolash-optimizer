import { useState } from 'react';
import type { Settings } from '../core/types';
import { t, type Locale } from '../i18n';
import { defaultEdgeLabel, formatNumber } from './format';
import { parseInput, validate, type NumericField } from './validate';

const FIELDS: { field: NumericField; mm: boolean }[] = [
  { field: 'maxLength', mm: true },
  { field: 'maxWidth', mm: true },
  { field: 'sawKerf', mm: true },
  { field: 'trimAllowance', mm: true },
  { field: 'defaultEdgeThickness', mm: true },
  { field: 'minStripWidth', mm: true },
  { field: 'shortStripRatio', mm: false },
  { field: 'orderDecimals', mm: false },
];

interface Props {
  locale: Locale;
  settings: Settings;
  onChange: (settings: Settings) => void;
}

/** Drafts keep what the user typed. The parent remounts this on reset and language change. */
export function SettingsPanel({ locale, settings, onChange }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const draft = (key: string, saved: string) => drafts[key] ?? saved;
  const type = (key: string, value: string) => setDrafts((d) => ({ ...d, [key]: value }));
  const error = (message: string) => <span className="text-sm text-red-700">{message}</span>;

  const label = draft('defaultEdgeLabel', defaultEdgeLabel(locale, settings));

  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{t(locale, 'settings.title')}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {FIELDS.map(({ field, mm }) => {
          const text = draft(field, formatNumber(locale, settings[field]));
          const invalid =
            drafts[field] === undefined ? null : validate(field, parseInput(text), settings);
          return (
            <label key={field} className="flex flex-col text-sm">
              {t(locale, `settings.${field}`)}
              <span className="flex items-center gap-1">
                <input
                  inputMode="decimal"
                  className="w-32 rounded border px-2 py-1 aria-invalid:border-red-700"
                  aria-invalid={invalid !== null}
                  value={text}
                  onChange={(event) => {
                    type(field, event.target.value);
                    const value = parseInput(event.target.value);
                    if (validate(field, value, settings) === null) {
                      onChange({ ...settings, [field]: value! });
                    }
                  }}
                />
                {mm && 'mm'}
              </span>
              {invalid && error(t(locale, invalid))}
            </label>
          );
        })}
        <label className="flex flex-col text-sm">
          {t(locale, 'settings.defaultEdgeLabel')}
          <input
            className="rounded border px-2 py-1"
            aria-invalid={label.trim() === ''}
            value={label}
            onChange={(event) => {
              type('defaultEdgeLabel', event.target.value);
              if (event.target.value.trim() !== '') {
                onChange({ ...settings, defaultEdgeLabel: event.target.value });
              }
            }}
          />
          {label.trim() === '' && error(t(locale, 'invalid.text'))}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.dimensionsIncludeEdge}
            onChange={(event) =>
              onChange({ ...settings, dimensionsIncludeEdge: event.target.checked })
            }
          />
          {t(locale, 'settings.dimensionsIncludeEdge')}
        </label>
      </div>
    </section>
  );
}
