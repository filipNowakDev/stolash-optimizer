import { useState } from 'react';
import { decodeFile, readTable, type Encoding, type Table } from '../core/parse';
import { t, type Locale } from '../i18n';

interface Props {
  locale: Locale;
  onLoad: (table: Table, encoding: Encoding | null) => void;
}

export function ImportCard({ locale, onLoad }: Props) {
  const [paste, setPaste] = useState('');
  const [empty, setEmpty] = useState(false);
  const [over, setOver] = useState(false);

  const load = (text: string, encoding: Encoding | null) => {
    const table = readTable(text);
    setEmpty(table.rows.length === 0);
    if (table.rows.length > 0) onLoad(table, encoding);
  };

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    const { text, encoding } = decodeFile(await file.arrayBuffer());
    load(text, encoding);
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <label
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition focus-within:ring-2 focus-within:ring-indigo-500 hover:border-indigo-400 hover:bg-indigo-50 ${over ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300'}`}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            void loadFile(event.dataTransfer.files[0]);
          }}
        >
          <span aria-hidden="true" className="text-3xl text-indigo-500">
            ⇪
          </span>
          <span className="font-medium">{t(locale, 'import.drop')}</span>
          <input
            type="file"
            accept=".csv,.txt"
            className="sr-only"
            onChange={(event) => {
              void loadFile(event.target.files?.[0]);
              // Lets the same file be chosen again.
              event.target.value = '';
            }}
          />
        </label>
        <div className="flex flex-col items-start gap-2">
          <textarea
            className="input min-h-28 w-full flex-1 font-mono text-sm"
            aria-label={t(locale, 'import.paste')}
            placeholder={t(locale, 'import.pastePlaceholder')}
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
          />
          <button
            type="button"
            className="btn"
            disabled={paste.trim() === ''}
            onClick={() => {
              load(paste, null);
              setPaste('');
            }}
          >
            {t(locale, 'import.load')}
          </button>
        </div>
      </div>
      {empty && <p className="text-red-700">{t(locale, 'import.empty')}</p>}
    </>
  );
}
