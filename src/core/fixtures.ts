// The 12 decoded rows of the sample "lista formatek" as listed in PRD section 9.
const ROWS = [
  ['', '300', '', '650', '', '18', '2', ''],
  ['', '282', '', '614', '', '18', '5', ''],
  ['', '2354', '', '282', '', '18', '2', ''],
  ['Przykład B', '600', '', '1024', '—', '18', '2', ''],
  ['Przykład C', '590', '', '1024', '—', '18', '3', ''],
  ['Przykład A', '2390', '—', '600', '', '18', '4', ''],
  ['Przykład D', '2388', '=', '528', '=', '18', '2', ''],
  ['Przykład E', '15', '', '15', '', '1024', '1', 'Inne\\lustro srebrne'],
  ['Przykład B', '600', '', '1264', '—', '18', '2', ''],
  ['Przykład C', '590', '', '1264', '—', '18', '3', ''],
  ['Przykład D', '2388', '=', '648', '=', '18', '2', ''],
  ['Przykład E', '15', '', '15', '', '1264', '1', 'Inne\\lustro srebrne'],
];

const withBlankMarks = ROWS.map((row) =>
  row.map((cell, i) => ((i === 2 || i === 4) && cell === '' ? '   ' : cell)),
);

export const FORMATEK_CSV = withBlankMarks
  .map((row) => row.map((cell) => `"${cell}"`).join(';'))
  .join('\r\n');
export const FORMATEK_TXT = withBlankMarks.map((row) => row.join('\t')).join('\r\n');

const CP1250: Record<string, number> = { ł: 0xb3, '—': 0x97 };

export const toWindows1250 = (text: string): ArrayBuffer =>
  Uint8Array.from(text, (char) => CP1250[char] ?? char.charCodeAt(0)).buffer;
