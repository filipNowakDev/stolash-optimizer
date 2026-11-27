// Pure: no DOM, storage or dictionaries (PRD section 15).
import { binPack } from './binpack';
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
    c.acrossGrain,
  ]);
}

/** Integer micrometers keep sums exact. */
const um = (mm: number) => Math.round(mm * 1000);

/** PRD section 13. */
export function pack(candidates: Candidate[], settings: Settings): PackResult {
  const { maxLength, sawKerf, trimAllowance, shortStripRatio, minStripWidth } = settings;
  const usable = um(maxLength - trimAllowance);
  const kerf = um(sawKerf);
  const result: PackResult = { strips: [], exceptions: [], proven: true };

  const groups = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    if (candidate.pieceLength > maxLength) {
      result.exceptions.push({ part: candidate.part, reason: 'longerThanBoard' });
      continue;
    }
    const key = groupKey(candidate);
    const group = groups.get(key);
    if (group) group.push(candidate);
    else groups.set(key, [candidate]);
  }

  const isShort = (used: number) => used < shortStripRatio * usable - 1e-6;
  const orderUm = (used: number) => (isShort(used) ? used + um(trimAllowance) : um(maxLength));

  for (const [key, group] of groups) {
    const head = group[0]!;
    const pieces: StripPiece[] = group.flatMap((c) =>
      Array.from({ length: c.part.quantity }, () => ({
        name: c.part.name,
        length: c.pieceLength,
      })),
    );
    // Stable sort: equal length and name keep their input order.
    pieces.sort((a, b) => b.length - a.length || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    const addStrip = (content: StripPiece[], trimTight: boolean) => {
      const used = content.reduce((sum, p) => sum + um(p.length), kerf * (content.length - 1));
      const short = !trimTight && isShort(used);
      const order = trimTight ? um(maxLength) : orderUm(used);
      const flags: StripFlag[] = [];
      if (short) flags.push('short');
      if (head.boardWidth < minStripWidth) flags.push('narrow');
      if (head.acrossGrain) flags.push('acrossGrain');
      if (trimTight) flags.push('trimTight');
      result.strips.push({
        groupKey: key,
        material: head.part.material,
        thickness: head.part.thickness,
        edgeL1: head.edgeL1,
        edgeL2: head.edgeL2,
        stripWidth: head.boardWidth,
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
    );
    result.proven &&= packed.proven;
    const bins = packed.bins.map((bin) => bin.map((i) => regular[i]!));
    const length = (bin: StripPiece[]) => bin.reduce((sum, p) => sum + p.length + sawKerf, 0);
    bins.sort((a, b) => length(b) - length(a));
    for (const bin of bins) addStrip(bin, false);
  }

  return result;
}
