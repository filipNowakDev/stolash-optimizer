import { useEffect, useMemo, useRef, useState } from 'react';
import { calculateVersions } from '../core/job';
import { isMapComplete, parseRows, proposeMap, type Encoding, type Table } from '../core/parse';
import { FACTORY_SETTINGS } from '../core/settings';
import type { Settings } from '../core/types';
import { detectLocale, t, type Locale } from '../i18n';
import type { ProjectStore, Session, Snapshot } from '../store/ProjectStore';
import { ColumnsTab, type Draft } from './ColumnsTab';
import { GenerateBar, type GenerateState } from './GenerateBar';
import { HeaderMenu } from './HeaderMenu';
import { ImportCard } from './ImportCard';
import { Materials, suggestedGrain } from './Materials';
import { PartSelection } from './PartSelection';
import { Results } from './Results';
import { SettingsPanel, type SettingsGroup } from './SettingsPanel';
import { Tabs, type TabItem } from './Tabs';
import { Versions } from './Versions';

type SetupTab = 'elements' | 'materials' | SettingsGroup | 'columns';

const snapshot = (session: Session, settings: Settings): Snapshot => ({
  settings,
  excluded: [...session.excluded].sort((a, b) => a - b),
  grainLock: session.grainLock,
});

/** Equal values compare equal whatever order their keys were written in. */
const stable = (value: unknown) =>
  JSON.stringify(value, (_, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );

/** A session saved before the Generate button already had results on screen. */
function restore(store: ProjectStore): Session | null {
  const saved = store.loadSession();
  if (!saved) return null;
  const session = { ...saved, excluded: saved.excluded ?? [] };
  if (session.generated === undefined) {
    session.generated = snapshot(session, store.loadSettings());
  }
  return session;
}

export function App({ store }: { store: ProjectStore }) {
  const [locale, setLocale] = useState<Locale>(
    () => store.loadLocale() ?? detectLocale(navigator.language),
  );
  const [settings, setSettings] = useState<Settings>(() => store.loadSettings());
  const [session, setSession] = useState<Session | null>(() => restore(store));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<SetupTab>('elements');
  const [resets, setResets] = useState(0);
  const results = useRef<HTMLElement>(null);
  const scrollToResults = useRef(false);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (!scrollToResults.current) return;
    scrollToResults.current = false;
    results.current?.scrollIntoView?.({ behavior: 'smooth' });
  });

  const changeSettings = (next: Settings) => {
    setSettings(next);
    void store.saveSettings(next);
  };

  const changeSession = (next: Session | null) => {
    setSession(next);
    void (next ? store.saveSession(next) : store.clearSession());
  };

  /** Reads the parts out of a table. Results appear only after Generate. */
  const read = (next: Draft, grain: Record<string, boolean>) => {
    setDraft(next);
    if (!isMapComplete(next.map)) {
      changeSession(null);
      setTab('columns');
      return;
    }
    const { parts, skipped } = parseRows(next.table, next.map);
    changeSession({
      parts,
      skipped,
      excluded: [],
      grainLock: suggestedGrain(parts, grain),
      doubledGroups: {},
      timestamp: Date.now(),
      generated: null,
    });
  };

  const load = (table: Table, encoding: Encoding | null) => {
    setTab('elements');
    read({ table, encoding, ...proposeMap(table, store.loadColumnMap()) }, {});
  };

  const generated = session?.generated;
  const state: GenerateState = !session
    ? 'noFile'
    : session.excluded.length >= session.parts.length
      ? 'noElements'
      : !generated
        ? 'ready'
        : stable(generated) === stable(snapshot(session, settings))
          ? 'current'
          : 'stale';

  const generate = () => {
    if (draft) void store.saveColumnMap(draft.map);
    scrollToResults.current = true;
    changeSession({ ...session!, generated: snapshot(session!, settings), version: undefined });
  };

  // Only what was generated is calculated; language and version never repack.
  const versions = useMemo(
    () =>
      session && generated
        ? calculateVersions(
            session.parts.filter((_, i) => !generated.excluded.includes(i)),
            generated.settings,
            generated.grainLock,
            session.doubledGroups,
          )
        : null,
    [session?.parts, generated, session?.doubledGroups],
  );
  const result = versions?.find((v) => v.id === session?.version) ?? versions?.[0];

  const needsFile = <p className="muted">{t(locale, 'setup.noFile')}</p>;
  const parameters = (group: SettingsGroup): TabItem<SetupTab> => ({
    id: group,
    label: t(locale, `setup.tab.${group}`),
    content: () => (
      <SettingsPanel
        key={`${locale}-${resets}`}
        locale={locale}
        group={group}
        settings={settings}
        onChange={changeSettings}
      />
    ),
  });

  const setupTabs: TabItem<SetupTab>[] = [
    {
      id: 'elements',
      label: session
        ? `${t(locale, 'setup.tab.elements')} (${session.parts.length - session.excluded.length}/${session.parts.length})`
        : t(locale, 'setup.tab.elements'),
      content: () =>
        session ? (
          <PartSelection
            locale={locale}
            parts={session.parts}
            excluded={session.excluded}
            onChange={(excluded) => changeSession({ ...session, excluded })}
          />
        ) : (
          needsFile
        ),
    },
    {
      id: 'materials',
      label: t(locale, 'setup.tab.materials'),
      content: () =>
        session ? (
          <Materials
            locale={locale}
            parts={session.parts}
            grainLock={session.grainLock}
            onChange={(grainLock) => changeSession({ ...session, grainLock })}
          />
        ) : (
          needsFile
        ),
    },
    parameters('board'),
    parameters('edging'),
    parameters('optimisation'),
    {
      id: 'columns',
      label: t(locale, 'setup.tab.columns'),
      content: () =>
        draft ? (
          <ColumnsTab
            locale={locale}
            draft={draft}
            onChange={(map) => read({ ...draft, map }, session?.grainLock ?? {})}
          />
        ) : (
          <p className="muted">{t(locale, session ? 'setup.reload' : 'setup.noFile')}</p>
        ),
    },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-semibold tracking-tight">
            <span aria-hidden="true" className="mr-2 text-indigo-600">
              ▤
            </span>
            {t(locale, 'app.title')}
          </h1>
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
              setDraft(null);
              changeSession(null);
            }}
          />
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 print:max-w-none print:p-0">
        <div className="flex flex-col gap-6 print:hidden">
          <section className="card">
            <h2 className="step">
              <span>1</span>
              {t(locale, 'import.title')}
            </h2>
            <ImportCard locale={locale} onLoad={load} />
            {session && (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="badge">
                  {t(locale, 'import.loaded', { n: session.parts.length })}
                </span>
                {draft?.formatek && <span className="badge">{t(locale, 'import.profile')}</span>}
                {draft?.encoding && <span className="muted">{draft.encoding}</span>}
                {session.skipped.length > 0 && (
                  <span className="text-amber-700">
                    {t(locale, 'results.skipped', { n: session.skipped.length })}
                  </span>
                )}
              </p>
            )}
          </section>

          <section className="card">
            <h2 className="step">
              <span>2</span>
              {t(locale, 'setup.title')}
            </h2>
            <Tabs tabs={setupTabs} active={tab} onChange={setTab} keepMounted />
          </section>

          <GenerateBar locale={locale} state={state} onGenerate={generate} />
        </div>

        {session && versions && result && generated && (
          <>
            <section ref={results} className="card print:hidden">
              <h2 className="step">
                <span>3</span>
                {t(locale, 'results.title')}
              </h2>
              {state === 'stale' && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  {t(locale, 'generate.hint.stale')}
                </p>
              )}
              <Versions
                locale={locale}
                versions={versions}
                selected={result.id}
                onSelect={(version) => changeSession({ ...session, version })}
              />
            </section>
            <Results
              locale={locale}
              settings={generated.settings}
              result={result}
              skipped={session.skipped}
              doubled={session.doubledGroups}
              onDoubledChange={(doubledGroups) => changeSession({ ...session, doubledGroups })}
            />
          </>
        )}
      </main>
    </div>
  );
}
