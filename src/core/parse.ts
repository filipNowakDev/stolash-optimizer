// Decoding, delimiter detection and column mapping (PRD section 9).
import Papa from 'papaparse';
import type { Edge, EdgeProduct, Edges, Part, ReasonId } from './types';

export type Encoding = 'utf-8' | 'windows-1250';
export type Delimiter = ';' | '\t' | ',';

export const ROLES = [
  'name',
  'material',
  'length',
  'width',
  'thickness',
  'quantity',
  'lengthMark',
  'widthMark',
  'left',
  'right',
  'top',
  'bottom',
  'edges',
] as const;
export type Role = (typeof ROLES)[number];

export type EdgeMode = 'marks' | 'four' | 'single';

export interface ColumnMap {
  mode: EdgeMode;
  hasHeader: boolean;
  columns: Partial<Record<Role, number>>;
  /** Normalized cell value to banded edges, for the one-column mode. */
  edgeTable: Record<string, Edge[]>;
  /** Header cells or column count; a stored map is reused only on a match. */
  signature: string;
}

export interface Table {
  rows: string[][];
  delimiter: Delimiter;
}

export interface SkippedRow {
  /** 1-based line in the table. */
  row: number;
  reason: ReasonId;
  text: string;
}

export function decodeFile(buffer: ArrayBuffer): { text: string; encoding: Encoding } {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'utf-8' };
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!text.includes('�')) return { text, encoding: 'utf-8' };
  } catch {
    // Not UTF-8.
  }
  return { text: new TextDecoder('windows-1250').decode(bytes), encoding: 'windows-1250' };
}

export function detectDelimiter(text: string): Delimiter {
  const line = text.split(/\r\n|\r|\n/).find((l) => l.trim() !== '') ?? '';
  const counts: Record<Delimiter, number> = { ';': 0, '\t': 0, ',': 0 };
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char in counts) counts[char as Delimiter]++;
  }
  // Array order is the tie break.
  return ([';', '\t', ','] as const).reduce((best, d) => (counts[d] > counts[best] ? d : best));
}

export function readTable(text: string): Table {
  const clean = text.replace(/^﻿/, '');
  const delimiter = detectDelimiter(clean);
  const { data } = Papa.parse<string[]>(clean, {
    header: false,
    delimiter,
    skipEmptyLines: true,
  });
  return { rows: data.filter((row) => row.some((cell) => cell.trim() !== '')), delimiter };
}

export function parseNumber(cell: string, delimiter: Delimiter): number | null {
  let text = cell.replace(/\s/g, '');
  if (delimiter !== ',') text = text.replace(',', '.');
  return /^-?(\d+(\.\d*)?|\.\d+)$/.test(text) ? Number(text) : null;
}

export function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');
}

const SYNONYMS: Partial<Record<Role, string[]>> = {
  name: ['nazwa', 'element', 'nazwa elementu', 'opis', 'name', 'part'],
  material: ['material', 'materiał', 'plyta', 'płyta', 'dekor', 'board', 'decor'],
  length: ['dlugosc', 'długość', 'dl.', 'length'],
  width: ['szerokosc', 'szerokość', 'szer.', 'width'],
  thickness: ['grubosc', 'grubość', 'thickness'],
  quantity: ['ilosc', 'ilość', 'qty', 'szt', 'sztuki', 'quantity'],
  left: ['lewa', 'lewo', 'krawedz lewa', 'L', 'left'],
  right: ['prawa', 'prawo', 'krawedz prawa', 'P', 'right'],
  top: ['gora', 'góra', 'gorna', 'krawedz gorna', 'top'],
  bottom: ['dol', 'dół', 'dolna', 'krawedz dolna', 'bottom'],
  edges: ['obrzeza', 'obrzeże', 'okleina', 'krawedzie', 'edges', 'banding'],
};

const L: Edge[] = ['left'];
const L2: Edge[] = ['left', 'right'];
const ADJACENT: Edge[] = ['left', 'top'];
const THREE: Edge[] = ['left', 'right', 'top'];
const FOUR: Edge[] = ['left', 'right', 'top', 'bottom'];

export const STARTER_EDGE_TABLE: Record<string, Edge[]> = Object.fromEntries(
  (
    [
      [['', '-', 'brak', '0', 'nie', 'no', 'none'], []],
      [['1', 'l1', '1l', 'jedna', 'dluzsza', 'one', 'longer'], L],
      [['2', 'l1l2', '2l', 'przeciwlegle', 'dwie przeciwlegle', 'opposite'], L2],
      [['2s', 'kat', 'sasiednie', 'dwie sasiednie', 'adjacent'], ADJACENT],
      [['3', '3l', 'trzy', 'three'], THREE],
      [['4', '4l', 'dookola', 'around', 'all'], FOUR],
    ] as [string[], Edge[]][]
  ).flatMap(([values, mask]) => values.map((value) => [value, mask])),
);

const ONE_EDGE_MARKS = ['—', '–', '-'];
const isMark = (cell: string) => ['', '=', ...ONE_EDGE_MARKS].includes(cell.trim());

export function isFormatekProfile({ rows, delimiter }: Table): boolean {
  return (
    rows.length > 0 &&
    rows.every(
      (r) =>
        r.length === 8 &&
        parseNumber(r[1]!, delimiter) !== null &&
        parseNumber(r[3]!, delimiter) !== null &&
        isMark(r[2]!) &&
        isMark(r[4]!),
    )
  );
}

const FORMATEK_COLUMNS: Partial<Record<Role, number>> = {
  name: 0,
  length: 1,
  lengthMark: 2,
  width: 3,
  widthMark: 4,
  thickness: 5,
  quantity: 6,
  material: 7,
};

function matchHeader(header: string[]): Partial<Record<Role, number>> {
  const cells = header.map(normalize);
  const columns: Partial<Record<Role, number>> = {};
  for (const role of ROLES) {
    const names = SYNONYMS[role]?.map(normalize);
    const index = cells.findIndex((cell) => names?.includes(cell));
    if (index >= 0) columns[role] = index;
  }
  return columns;
}

function guessMode(columns: ColumnMap['columns']): EdgeMode {
  if (columns.lengthMark !== undefined || columns.widthMark !== undefined) return 'marks';
  if ((['left', 'right', 'top', 'bottom'] as const).some((r) => columns[r] !== undefined)) {
    return 'four';
  }
  return columns.edges !== undefined ? 'single' : 'marks';
}

export function proposeMap(
  table: Table,
  stored: ColumnMap | null,
): { map: ColumnMap; formatek: boolean } {
  const edgeTable = { ...STARTER_EDGE_TABLE, ...stored?.edgeTable };
  if (isFormatekProfile(table)) {
    const map: ColumnMap = {
      mode: 'marks',
      hasHeader: false,
      columns: { ...FORMATEK_COLUMNS },
      edgeTable,
      signature: 'formatek',
    };
    return { map, formatek: true };
  }

  const first = table.rows[0] ?? [];
  const matched = matchHeader(first);
  const hasHeader =
    Object.keys(matched).length > 0 ||
    first.every((cell) => parseNumber(cell, table.delimiter) === null);
  const signature = hasHeader ? first.map(normalize).join('|') : `columns:${first.length}`;

  if (stored?.signature === signature) return { map: { ...stored, edgeTable }, formatek: false };

  const columns = hasHeader ? matched : {};
  return {
    map: { mode: guessMode(columns), hasHeader, columns, edgeTable, signature },
    formatek: false,
  };
}

export const isMapComplete = ({ columns }: ColumnMap) =>
  columns.length !== undefined && columns.width !== undefined && columns.quantity !== undefined;

const BARE_CELLS = ['', '-', 'brak', 'nie', 'no', '0'];
const defaultProduct = (): EdgeProduct => ({ label: null, thickness: null });

function namedEdge(cell: string): EdgeProduct | null {
  if (BARE_CELLS.includes(normalize(cell))) return null;
  const found = /\d+(?:[.,]\d+)?/.exec(cell);
  if (!found) return defaultProduct();
  return { label: cell.trim(), thickness: Number(found[0].replace(',', '.')) };
}

/** null means the row has an unknown edge value. */
function readEdges(row: string[], map: ColumnMap): Edges | null {
  const cell = (role: Role) => {
    const index = map.columns[role];
    return index === undefined ? '' : (row[index] ?? '').trim();
  };
  const edges: Edges = {};

  if (map.mode === 'marks') {
    const dimensions: [Role, Edge, Edge][] = [
      ['lengthMark', 'left', 'right'],
      ['widthMark', 'top', 'bottom'],
    ];
    for (const [role, first, second] of dimensions) {
      const mark = cell(role);
      if (!isMark(mark)) return null;
      if (mark === '') continue;
      edges[first] = defaultProduct();
      if (mark === '=') edges[second] = defaultProduct();
    }
  } else if (map.mode === 'four') {
    for (const edge of FOUR) {
      const product = namedEdge(cell(edge));
      if (product) edges[edge] = product;
    }
  } else {
    const mask = map.edgeTable[normalize(cell('edges'))];
    if (!mask) return null;
    for (const edge of mask) edges[edge] = defaultProduct();
  }
  return edges;
}

export function parseRows(table: Table, map: ColumnMap): { parts: Part[]; skipped: SkippedRow[] } {
  const parts: Part[] = [];
  const skipped: SkippedRow[] = [];

  table.rows.forEach((row, index) => {
    if (map.hasHeader && index === 0) return;
    const cell = (role: Role) => {
      const column = map.columns[role];
      return column === undefined ? '' : (row[column] ?? '').trim();
    };
    const skip = (reason: ReasonId) =>
      skipped.push({ row: index + 1, reason, text: row.join(' | ') });
    const number = (role: Role) => parseNumber(cell(role), table.delimiter);

    const length = number('length');
    const width = number('width');
    const thickness = number('thickness');
    if (!length || length <= 0 || !width || width <= 0) return skip('badDimension');
    if (cell('thickness') !== '' && thickness === null) return skip('badDimension');
    const quantity = number('quantity');
    if (quantity === null || !Number.isInteger(quantity) || quantity < 1) {
      return skip('badQuantity');
    }
    const edges = readEdges(row, map);
    if (!edges) return skip('unknownEdge');

    parts.push({
      name: cell('name'),
      material: cell('material'),
      thickness,
      length,
      width,
      quantity,
      edges,
    });
  });

  return { parts, skipped };
}

const PLAIN_MATERIALS = [
  'bialy', 'szary', 'czarny', 'uni', 'jednolity', 'kolor', 'white', 'grey', 'gray', 'black',
  'solid', 'color', 'colour', 'lustro', 'mirror', 'szklo', 'glass',
];

/** Suggested "Keep grain direction" for a material name. */
export function suggestGrainLock(material: string): boolean {
  const name = normalize(material);
  return !PLAIN_MATERIALS.some((word) => name.includes(word));
}
