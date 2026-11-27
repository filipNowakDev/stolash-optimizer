import { useEffect, useMemo, useState } from 'react';
import { calculateVersions } from '../core/job';
import { FACTORY_SETTINGS } from '../core/settings';
import type { Settings } from '../core/types';
import { detectLocale, t, type Locale } from '../i18n';
import type { ProjectStore, Session } from '../store/ProjectStore';
import { HeaderMenu } from './HeaderMenu';
import { ImportPanel } from './ImportPanel';
import { Materials } from './Materials';
import { PartSelection } from './PartSelection';
import { Results } from './Results';
import { SettingsPanel } from './SettingsPanel';
import { Versions } from './Versions';

export function App({ store }: { store: ProjectStore }) {
  const [locale, setLocale] = useState<Locale>(
    () => store.loadLocale() ?? detectLocale(navigator.language),
  );
  const [settings, setSettings] = useState<Settings>(() => store.loadSettings());
  const [session, setSession] = useState<Session | null>(() => store.loadSession());
  const [resets, setResets] = useState(0);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const changeSettings = (next: Settings) => {
    setSettings(next);
    void store.saveSettings(next);
  };

  const changeSession = (next: Session) => {
    setSession(next);
    void store.saveSession(next);
  };

  // Language is deliberately not a dependency: switching it never repacks.
  const versions = useMemo(
    () =>
      session &&
      calculateVersions(
        session.parts.filter((_, i) => !session.excluded?.includes(i)),
        settings,
        session.grainLock,
        session.doubledGroups,
      ),
    // Picking a version must not recalculate.
    [session?.parts, session?.excluded, session?.grainLock, session?.doubledGroups, settings],
  );
  const result = versions?.find((v) => v.id === session?.version) ?? versions?.[0];

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-4 py-2 print:hidden">
        <h1 className="text-lg font-semibold">{t(locale, 'app.title')}</h1>
        <HeaderMenu
          locale={locale}
          onLocaleChange={(next) => {
            setLocale(next);
            void store.saveLocale(next);
          }}
          onResetPreferences={() => {
            changeSettings({ ...FACTORY_SETTINGS });
            setResets((n) => n + 1);
          }}
          onClearSession={() => {
            setSession(null);
            void store.clearSession();
          }}
        />
      </header>
      <main className="flex flex-col gap-6 p-4 print:p-0">
        <div className="flex flex-col gap-6 print:hidden">
          <ImportPanel
            locale={locale}
            storedMap={() => store.loadColumnMap()}
            onImport={({ parts, skipped, excluded, grainLock, map }) => {
              void store.saveColumnMap(map);
              changeSession({
                parts,
                skipped,
                excluded,
                grainLock,
                doubledGroups: {},
                timestamp: Date.now(),
              });
            }}
          />
          <SettingsPanel
            key={`${locale}-${resets}`}
            locale={locale}
            settings={settings}
            onChange={changeSettings}
          />
          {session && (
            <PartSelection
              // A new import starts collapsed.
              key={session.timestamp}
              locale={locale}
              parts={session.parts}
              excluded={session.excluded ?? []}
              onChange={(excluded) => changeSession({ ...session, excluded })}
            />
          )}
          {session && (
            <Materials
              locale={locale}
              parts={session.parts}
              grainLock={session.grainLock}
              onChange={(grainLock) => changeSession({ ...session, grainLock })}
            />
          )}
        </div>
        {session && versions && result && (
          <div className="print:hidden">
            <Versions
              locale={locale}
              versions={versions}
              selected={result.id}
              onSelect={(version) => changeSession({ ...session, version })}
            />
          </div>
        )}
        {session && result && (
          <Results
            locale={locale}
            settings={settings}
            result={result}
            skipped={session.skipped}
            doubled={session.doubledGroups}
            onDoubledChange={(doubledGroups) => changeSession({ ...session, doubledGroups })}
          />
        )}
      </main>
    </div>
  );
}
