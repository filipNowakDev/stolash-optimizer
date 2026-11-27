import type { Locale } from '../i18n';
import { formatNumber } from './format';
import type { Cell, Table } from './tables';

const text = (locale: Locale, cell: Cell) =>
  typeof cell === 'number' ? formatNumber(locale, cell) : (cell ?? '');

const lines = (table: Table) => [table.headers as Cell[], ...table.rows];

export function toCsv(table: Table, locale: Locale): string {
  const delimiter = locale === 'pl' ? ';' : ',';
  const quote = (value: string) =>
    value.includes(delimiter) || /["\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const body = lines(table)
    .map((row) => row.map((cell) => quote(text(locale, cell))).join(delimiter))
    .join('\r\n');
  // The BOM makes Excel read Polish characters as UTF-8.
  return `﻿${body}\r\n`;
}

export function toTsv(table: Table, locale: Locale): string {
  return lines(table)
    .map((row) => row.map((cell) => text(locale, cell).replace(/[\t\r\n]+/g, ' ')).join('\t'))
    .join('\n');
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(table: Table, locale: Locale) {
  download(
    new Blob([toCsv(table, locale)], { type: 'text/csv;charset=utf-8' }),
    `${table.sheet}.csv`,
  );
}

export async function downloadXlsx(table: Table) {
  // Loaded on demand: it is the largest dependency and only export needs it.
  const XLSX = await import('xlsx');
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(lines(table)), table.sheet);
  XLSX.writeFile(book, `${table.sheet}.xlsx`);
}
