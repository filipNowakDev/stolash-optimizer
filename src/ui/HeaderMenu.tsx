import { useState } from 'react';
import { LOCALE_NAMES, t, type Locale } from '../i18n';

interface Props {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  onResetPreferences: () => void;
  onClearSession: () => void;
}

export function HeaderMenu({ locale, onLocaleChange, onResetPreferences, onClearSession }: Props) {
  const [open, setOpen] = useState(false);

  const run = (action: () => void) => () => {
    action();
    setOpen(false);
  };

  return (
    <div className="relative" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t(locale, 'menu.button')}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 flex w-64 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="muted mb-1">{t(locale, 'menu.language')}</legend>
            {(Object.keys(LOCALE_NAMES) as Locale[]).map((code) => (
              <button
                key={code}
                type="button"
                lang={code}
                aria-pressed={code === locale}
                className="btn aria-pressed:border-indigo-500 aria-pressed:bg-indigo-50 aria-pressed:font-semibold"
                onClick={run(() => onLocaleChange(code))}
              >
                {LOCALE_NAMES[code]}
              </button>
            ))}
          </fieldset>
          <button type="button" className="btn" onClick={run(onResetPreferences)}>
            {t(locale, 'menu.resetPreferences')}
          </button>
          <button type="button" className="btn text-red-700" onClick={run(onClearSession)}>
            {t(locale, 'menu.clearSession')}
          </button>
        </div>
      )}
    </div>
  );
}
