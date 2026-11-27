// Order rows and collapsed part lists (PRD sections 13-14). Pure.
import { round } from './numbers';
import type { EdgeLabel, Part, PartException, Settings, Strip, StripFlag } from './types';

export interface OrderRow {
  quantity: number;
  length: number;
  width: number;
  thickness: number | null;
  material: string;
  edgeL1: EdgeLabel | undefined;
  edgeL2: EdgeLabel | undefined;
  flags: StripFlag[];
}

/** A narrow single-banded group whose doubled blank still fits the sheet. */
export function canDouble(strip: Strip, settings: Settings): boolean {
  return (
    strip.flags.includes('narrow') &&
    strip.edgeL1 !== undefined &&
    strip.edgeL2 === undefined &&
    2 * strip.stripWidth + settings.sawKerf <= settings.maxWidth
  );
}

/** Flags the strips that are cut from a doubled blank: full-length pairs only. */
export function applyDoubling(
  strips: Strip[],
  settings: Settings,
  doubled: Record<string, boolean>,
): Strip[] {
  const eligible = (s: Strip) =>
    doubled[s.groupKey] === true && canDouble(s, settings) && !s.flags.includes('short');
  const left = new Map<string, number>();
  for (const s of strips) {
    if (eligible(s)) left.set(s.groupKey, (left.get(s.groupKey) ?? 0) + 1);
  }
  // Only an even number can be paired.
  for (const [key, count] of left) left.set(key, count - (count % 2));

  return strips.map((s) => {
    const remaining = left.get(s.groupKey) ?? 0;
    if (!eligible(s) || remaining === 0) return s;
    left.set(s.groupKey, remaining - 1);
    return { ...s, flags: [...s.flags, 'doubled'] };
  });
}

/** Takes strips that went through applyDoubling. */
export function orderRows(strips: Strip[], settings: Settings): OrderRow[] {
  const decimals = settings.orderDecimals;
  const rows = new Map<string, OrderRow & { strips: number }>();
  for (const strip of strips) {
    const doubled = strip.flags.includes('doubled');
    const row: OrderRow = {
      quantity: 0,
      length: round(strip.orderLength, decimals),
      width: doubled
        ? round(2 * strip.stripWidth + settings.sawKerf, decimals)
        : strip.stripWidth,
      thickness: strip.thickness,
      material: strip.material,
      edgeL1: strip.edgeL1,
      edgeL2: doubled ? strip.edgeL1 : strip.edgeL2,
      flags: strip.flags,
    };
    const key = JSON.stringify(row);
    const existing = rows.get(key) ?? { ...row, strips: 0 };
    existing.strips++;
    rows.set(key, existing);
  }
  return [...rows.values()].map(({ strips: count, ...row }) => ({
    ...row,
    quantity: row.flags.includes('doubled') ? count / 2 : count,
  }));
}

/** Merges parts that differ only in quantity. */
export function collapseParts(parts: Part[]): Part[] {
  const merged = new Map<string, Part>();
  for (const part of parts) {
    const key = JSON.stringify({ ...part, quantity: 0 });
    const existing = merged.get(key);
    if (existing) existing.quantity += part.quantity;
    else merged.set(key, { ...part });
  }
  return [...merged.values()];
}

export function collapseExceptions(exceptions: PartException[]): PartException[] {
  const byReason = new Map<PartException['reason'], Part[]>();
  for (const { part, reason } of exceptions) {
    byReason.set(reason, [...(byReason.get(reason) ?? []), part]);
  }
  return [...byReason].flatMap(([reason, parts]) =>
    collapseParts(parts).map((part) => ({ part, reason })),
  );
}
