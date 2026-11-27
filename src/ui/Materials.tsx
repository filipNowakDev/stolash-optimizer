import { suggestGrainLock } from '../core/parse';
import type { Part } from '../core/types';
import { t, type Locale } from '../i18n';
import { materialName } from './format';

interface Props {
  locale: Locale;
  parts: Part[];
  grainLock: Record<string, boolean>;
  onChange: (grainLock: Record<string, boolean>) => void;
}

export const suggestedGrain = (parts: Part[], chosen: Record<string, boolean> = {}) =>
  Object.fromEntries(
    parts.map((p) => [p.material, chosen[p.material] ?? suggestGrainLock(p.material)]),
  );

export function Materials({ locale, parts, grainLock, onChange }: Props) {
  return (
    <fieldset>
      <legend className="font-semibold">{t(locale, 'import.materials')}</legend>
      <ul>
        {[...new Set(parts.map((p) => p.material))].map((material) => (
          <li key={material} className="flex gap-4">
            <span className="w-64">{materialName(locale, material)}</span>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={grainLock[material] ?? true}
                onChange={(event) =>
                  onChange({ ...grainLock, [material]: event.target.checked })
                }
              />
              {t(locale, 'import.keepGrain')}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
