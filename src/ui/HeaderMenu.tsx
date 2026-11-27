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
    <div className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t(locale, 'menu.button')}
      </button>
      {open && (
        <div className="absolute right-0 flex w-64 flex-col items-start gap-2 border bg-white p-3">
          <fieldset>
            <legend>{t(locale, 'menu.language')}</legend>
            {(Object.keys(LOCALE_NAMES) as Locale[]).map((code) => (
              <button
                key={code}
                type="button"
                lang={code}
                aria-pressed={code === locale}
                className="mr-3 aria-pressed:font-bold"
                onClick={run(() => onLocaleChange(code))}
              >
                {LOCALE_NAMES[code]}
              </button>
            ))}
          </fieldset>
          <button type="button" onClick={run(onResetPreferences)}>
            {t(locale, 'menu.resetPreferences')}
          </button>
          <button type="button" onClick={run(onClearSession)}>
            {t(locale, 'menu.clearSession')}
          </button>
        </div>
      )}
    </div>
  );
}
