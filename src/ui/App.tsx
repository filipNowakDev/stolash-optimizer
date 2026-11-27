import { useEffect, useState } from 'react';
import { FACTORY_SETTINGS } from '../core/settings';
import { detectLocale, t, type Locale } from '../i18n';
import type { ProjectStore } from '../store/ProjectStore';
import { HeaderMenu } from './HeaderMenu';

export function App({ store }: { store: ProjectStore }) {
  const [locale, setLocale] = useState<Locale>(
    () => store.loadLocale() ?? detectLocale(navigator.language),
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <h1 className="text-lg font-semibold">{t(locale, 'app.title')}</h1>
        <HeaderMenu
          locale={locale}
          onLocaleChange={(next) => {
            setLocale(next);
            void store.saveLocale(next);
          }}
          onResetPreferences={() => void store.saveSettings({ ...FACTORY_SETTINGS })}
          onClearSession={() => void store.clearSession()}
        />
      </header>
      <main className="p-4">{t(locale, 'app.placeholder')}</main>
    </div>
  );
}
