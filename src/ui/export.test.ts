import { describe, expect, it } from 'vitest';
import { toCsv, toTsv } from './export';

const table = { sheet: 's', headers: ['Materiał', 'Szerokość'], rows: [['Dąb; "A"', 599.2]] };

describe('export', () => {
  it('writes Polish CSV with BOM, semicolons and comma decimals', () => {
    expect(toCsv(table, 'pl')).toBe('﻿Materiał;Szerokość\r\n"Dąb; ""A""";599,2\r\n');
  });

  it('writes English CSV with commas and dot decimals', () => {
    expect(toCsv(table, 'en')).toBe('﻿Materiał,Szerokość\r\n"Dąb; ""A""",599.2\r\n');
  });

  it('writes tab-separated text for the clipboard', () => {
    expect(toTsv(table, 'pl')).toBe('Materiał\tSzerokość\nDąb; "A"\t599,2');
  });
});
