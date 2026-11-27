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
    <ul className="divide-y divide-slate-100">
      {[...new Set(parts.map((p) => p.material))].map((material) => (
        <li key={material} className="flex flex-wrap items-center gap-4 py-2">
          <span className="w-72 text-sm font-medium">{materialName(locale, material)}</span>
          <label className="check">
            <input
              type="checkbox"
              checked={grainLock[material] ?? true}
              onChange={(event) => onChange({ ...grainLock, [material]: event.target.checked })}
            />
            {t(locale, 'import.keepGrain')}
          </label>
        </li>
      ))}
    </ul>
  );
}
