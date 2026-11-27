import { useState } from 'react';
import { ALGORITHMS, type Algorithm, type Settings } from '../core/types';
import { t, type Locale } from '../i18n';
import { defaultEdgeLabel, formatNumber } from './format';
import { parseInput, validate, type NumericField } from './validate';

export type SettingsGroup = 'board' | 'edging' | 'optimisation';

type Toggle = 'subtractEdge' | 'shortStrips' | 'fitNarrower';

const GROUPS: Record<SettingsGroup, { toggles: Toggle[]; fields: NumericField[] }> = {
  board: { toggles: [], fields: ['maxLength', 'maxWidth', 'sawKerf', 'trimAllowance'] },
  edging: { toggles: ['subtractEdge'], fields: ['defaultEdgeThickness'] },
  optimisation: {
    toggles: ['fitNarrower', 'shortStrips'],
    fields: ['shortStripRatio', 'minStripWidth', 'minOffcut', 'orderDecimals'],
  },
};

const UNITLESS: NumericField[] = ['shortStripRatio', 'orderDecimals'];

interface Props {
  locale: Locale;
  group: SettingsGroup;
  settings: Settings;
  onChange: (settings: Settings) => void;
}

/** Drafts keep what the user typed. The parent remounts this on reset and language change. */
export function SettingsPanel({ locale, group, settings, onChange }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const draft = (key: string, saved: string) => drafts[key] ?? saved;
  const type = (key: string, value: string) => setDrafts((d) => ({ ...d, [key]: value }));
  const error = (message: string) => <span className="text-sm text-red-700">{message}</span>;

  const label = draft('defaultEdgeLabel', defaultEdgeLabel(locale, settings));
  const { toggles, fields } = GROUPS[group];

  return (
    <div className="flex flex-col gap-4">
      {group === 'optimisation' && (
        <label className="field max-w-md">
          {t(locale, 'settings.algorithm')}
          <select
            className="input"
            value={settings.algorithm}
            onChange={(event) =>
              onChange({ ...settings, algorithm: event.target.value as Algorithm })
            }
          >
            {ALGORITHMS.map((id) => (
              <option key={id} value={id}>
                {t(locale, `algorithm.${id}`)}
              </option>
            ))}
          </select>
          <span className="muted font-normal">{t(locale, `algorithm.${settings.algorithm}.hint`)}</span>
        </label>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((field) => {
          const text = draft(field, formatNumber(locale, settings[field]));
          const invalid =
            drafts[field] === undefined ? null : validate(field, parseInput(text), settings);
          return (
            <label key={field} className="field">
              {t(locale, `settings.${field}`)}
              <span className="flex items-center gap-2">
                <input
                  inputMode="decimal"
                  disabled={field === 'shortStripRatio' && !settings.shortStrips}
                  className="input w-32"
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
                {!UNITLESS.includes(field) && <span className="text-slate-500">mm</span>}
              </span>
              {invalid && error(t(locale, invalid))}
            </label>
          );
        })}
        {group === 'edging' && (
          <label className="field">
            {t(locale, 'settings.defaultEdgeLabel')}
            <input
              className="input"
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
        )}
      </div>
      {toggles.map((toggle) => (
        <label key={toggle} className="check">
          <input
            type="checkbox"
            // First Fit Decreasing never moves parts between widths.
            disabled={toggle === 'fitNarrower' && settings.algorithm === 'ffd'}
            checked={settings[toggle]}
            onChange={(event) => onChange({ ...settings, [toggle]: event.target.checked })}
          />
          {t(locale, `settings.${toggle}`)}
        </label>
      ))}
    </div>
  );
}
