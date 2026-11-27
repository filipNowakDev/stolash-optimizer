import type { ReactNode } from 'react';

export interface TabItem<Id extends string> {
  id: Id;
  label: string;
  content: () => ReactNode;
}

interface Props<Id extends string> {
  tabs: TabItem<Id>[];
  active: Id;
  onChange: (id: Id) => void;
  /** Keeps hidden panels alive, so half-typed values survive a tab switch. */
  keepMounted?: boolean;
  testId?: string;
}

export function Tabs<Id extends string>({ tabs, active, onChange, keepMounted, testId }: Props<Id>) {
  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            className="tab"
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tabs
        .filter(({ id }) => keepMounted || id === active)
        .map(({ id, label, content }) => (
          <div
            key={id}
            role="tabpanel"
            aria-label={label}
            data-testid={testId}
            hidden={id !== active}
            className="pt-4"
          >
            {content()}
          </div>
        ))}
    </div>
  );
}
