// Result tables, shared by the screen and every export.
import type { Result } from '../core/job';
import type { Edge, Part, Settings } from '../core/types';
import { t, type Locale, type MessageId } from '../i18n';
import { edgeName, materialName } from './format';

export type Cell = string | number | null;

export interface Table {
  sheet: string;
  headers: string[];
  rows: Cell[][];
}

export type TableId = 'order' | 'finished' | 'unbanded';

export function buildTable(
  id: TableId,
  result: Result,
  settings: Settings,
  locale: Locale,
): Table {
  const headers = (...ids: MessageId[]) => ids.map((key) => t(locale, key));
  const sheet = t(locale, `sheet.${id}`);

  if (id === 'order') {
    return {
      sheet,
      headers: headers(
        'column.quantity', 'column.length', 'column.width', 'column.thickness',
        'column.material', 'column.edgeL1', 'column.edgeL2', 'column.remarks',
      ),
      rows: result.rows.map((row) => [
        row.quantity,
        row.length,
        row.width,
        row.thickness,
        materialName(locale, row.material),
        edgeName(locale, settings, row.edgeL1),
        edgeName(locale, settings, row.edgeL2),
        row.flags.map((flag) => t(locale, `flag.${flag}`)).join(', '),
      ]),
    };
  }

  const columns: MessageId[] = [
    'column.name', 'column.material', 'column.thickness',
    'column.length', 'column.width', 'column.quantity',
  ];
  const cells = (part: Part): Cell[] => [
    part.name,
    materialName(locale, part.material),
    part.thickness,
    part.length,
    part.width,
    part.quantity,
  ];

  if (id === 'unbanded') {
    return { sheet, headers: headers(...columns), rows: result.unbanded.map(cells) };
  }
  return {
    sheet,
    headers: headers(...columns, 'column.edges', 'column.reason'),
    rows: result.exceptions.map(({ part, reason }) => [
      ...cells(part),
      (Object.keys(part.edges) as Edge[])
        .map((edge) => {
          const label = part.edges[edge]!.label;
          const name = t(locale, `edge.${edge}`);
          return label ? `${name} (${label})` : name;
        })
        .join(', '),
      t(locale, `reason.${reason}`),
    ]),
  };
}
