import { t, type Locale, type MessageId } from '../i18n';

export type GenerateState = 'noFile' | 'noElements' | 'ready' | 'stale' | 'current';

const BUTTON: Record<GenerateState, MessageId> = {
  noFile: 'generate.new',
  noElements: 'generate.new',
  ready: 'generate.new',
  stale: 'generate.update',
  current: 'generate.current',
};

const TONE: Record<GenerateState, string> = {
  noFile: 'text-slate-500',
  noElements: 'text-amber-700',
  ready: 'text-slate-600',
  stale: 'text-amber-700',
  current: 'text-emerald-700',
};

/** Sits under all the settings and stays in view while they scroll. */
export function GenerateBar({
  locale,
  state,
  onGenerate,
}: {
  locale: Locale;
  state: GenerateState;
  onGenerate: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
      <p role="status" className={`text-sm ${TONE[state]}`}>
        {t(locale, `generate.hint.${state}`)}
      </p>
      <button
        type="button"
        className="btn btn-primary px-8 py-3 text-base"
        disabled={state !== 'ready' && state !== 'stale'}
        onClick={onGenerate}
      >
        {t(locale, BUTTON[state])}
      </button>
    </div>
  );
}
