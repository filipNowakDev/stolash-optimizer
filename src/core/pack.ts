// Pure: no DOM, storage or dictionaries (PRD section 15).
import { binPack } from './binpack';
import { fillNarrower } from './fill';
import { boardSize } from './settings';
import type { Candidate, PartException, Settings, Strip, StripFlag, StripPiece } from './types';

export interface PackResult {
  strips: Strip[];
  exceptions: PartException[];
  /** False when a group was too large to prove its layout optimal. */
  proven: boolean;
}

export function groupKey(c: Candidate): string {
  return JSON.stringify([
    c.part.material,
    c.part.thickness,
    // false is "no edge"; null is already the default label.
    c.edgeL1 === undefined ? false : c.edgeL1,
    c.edgeL2 === undefined ? false : c.edgeL2,
    c.boardWidth,
    c.edgeThickness,
    c.crossCut,
  ]);
}

/** Integer micrometers keep sums exact. */
const um = (mm: number) => Math.round(mm * 1000);

/** PRD section 13. */
export function pack(
  candidates: Candidate[],
  settings: Settings,
  /** 0 stops at First Fit Decreasing. */
  searchBudget?: number,
): PackResult {
  const { sawKerf, trimAllowance, shortStrips, shortStripRatio, minStripWidth } = settings;
  const kerf = um(sawKerf);
  const result: PackResult = { strips: [], exceptions: [], proven: true };

  const groups = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    if (candidate.pieceLength > boardSize(settings, candidate.crossCut).length) {
      result.exceptions.push({ part: candidate.part, reason: 'longerThanBoard' });
      continue;
    }
    const key = groupKey(candidate);
    const group = groups.get(key);
    if (group) group.push(candidate);
    else groups.set(key, [candidate]);
  }

  for (const [key, group] of groups) {
    const head = group[0]!;
    const boardLength = boardSize(settings, head.crossCut).length;
    const usable = um(boardLength - trimAllowance);
    const isShort = (used: number) => shortStrips && used < shortStripRatio * usable - 1e-6;
    const orderUm = (used: number) =>
      isShort(used) ? used + um(trimAllowance) : um(boardLength);
    const pieces: StripPiece[] = group.flatMap((c) =>
      Array.from({ length: c.part.quantity }, () => ({
        name: c.part.name,
        length: c.pieceLength,
        width: c.boardWidth,
      })),
    );
    // Stable sort: equal length and name keep their input order.
    pieces.sort((a, b) => b.length - a.length || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    const addStrip = (content: StripPiece[], trimTight: boolean) => {
      const used = content.reduce((sum, p) => sum + um(p.length), kerf * (content.length - 1));
      const short = !trimTight && isShort(used);
      const order = trimTight ? um(boardLength) : orderUm(used);
      const flags: StripFlag[] = [];
      if (short) flags.push('short');
      if (head.boardWidth < minStripWidth) flags.push('narrow');
      if (head.crossCut) flags.push('acrossGrain');
      if (trimTight) flags.push('trimTight');
      result.strips.push({
        groupKey: key,
        material: head.part.material,
        thickness: head.part.thickness,
        edgeL1: head.edgeL1,
        edgeL2: head.edgeL2,
        stripWidth: head.boardWidth,
        crossCut: head.crossCut,
        orderLength: order / 1000,
        pieces: content,
        usedLength: used / 1000,
        // A short strip keeps only the squaring allowance.
        offcut: (short ? um(trimAllowance) : order - used) / 1000,
        flags,
      });
    };

    const regular = pieces.filter((p) => um(p.length) <= usable);
    for (const piece of pieces) if (um(piece.length) > usable) addStrip([piece], true);

    // Each piece takes its length plus one kerf; the strip gets one kerf of slack back.
    const packed = binPack(
      regular.map((p) => um(p.length) + kerf),
      usable + kerf,
      (load) => orderUm(load - kerf),
      searchBudget,
    );
    result.proven &&= packed.proven;
    const bins = packed.bins.map((bin) => bin.map((i) => regular[i]!));
    const length = (bin: StripPiece[]) => bin.reduce((sum, p) => sum + p.length + sawKerf, 0);
    bins.sort((a, b) => length(b) - length(a));
    for (const bin of bins) addStrip(bin, false);
  }

  if (settings.fitNarrower) result.strips = fillNarrower(result.strips, settings);
  return result;
}
