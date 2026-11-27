import type { Locale } from '../i18n';
import { formatNumber } from './format';
import type { Table } from './tables';

export function DataTable({ locale, table }: { locale: Locale; table: Table }) {
  return (
    <table className="data">
      <thead>
        <tr>
          {table.headers.map((header) => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{typeof cell === 'number' ? formatNumber(locale, cell) : cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
