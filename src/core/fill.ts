// Moves narrower parts into the leftover of wider strips. Pure and deterministic.
import { boardSize } from './settings';
import type { Settings, Strip, StripPiece } from './types';

/** Integer micrometers keep sums exact. */
const um = (mm: number) => Math.round(mm * 1000);

/**
 * Strips may trade parts when the shop can rip a part narrower and keep its one
 * banded edge. A part banded on both edges would lose one, so L2 strips stay out.
 */
function family(strip: Strip): string | null {
  if (strip.edgeL2 !== undefined || strip.flags.includes('trimTight')) return null;
  const [material, thickness, l1, l2, , edgeThickness, crossCut] = JSON.parse(
    strip.groupKey,
  ) as unknown[];
  return JSON.stringify([material, thickness, l1, l2, edgeThickness, crossCut]);
}

/** Length, order length and leftover of a strip holding these pieces. */
export function measure(pieces: StripPiece[], crossCut: boolean, settings: Settings) {
  const boardLength = boardSize(settings, crossCut).length;
  const usable = um(boardLength - settings.trimAllowance);
  const used = pieces.reduce(
    (sum, p) => sum + um(p.length),
    um(settings.sawKerf) * (pieces.length - 1),
  );
  const trimTight = used > usable;
  const short =
    settings.shortStrips && !trimTight && used < settings.shortStripRatio * usable - 1e-6;
  const order = short ? used + um(settings.trimAllowance) : um(boardLength);
  return {
    fits: used <= usable,
    short,
    trimTight,
    usedLength: used / 1000,
    orderLength: order / 1000,
    // A short strip keeps only the squaring allowance.
    offcut: (short ? um(settings.trimAllowance) : order - used) / 1000,
  };
}

/** Ordered board area, which is what the moves below reduce. */
function area(strip: Strip, pieces: StripPiece[], settings: Settings): number {
  if (pieces.length === 0) return 0;
  return strip.stripWidth * measure(pieces, strip.crossCut, settings).orderLength;
}

/** The same strip, holding other pieces. */
function rebuild(strip: Strip, content: StripPiece[], settings: Settings): Strip {
  const pieces = [...content].sort((a, b) => b.width - a.width || b.length - a.length);
  const { short, usedLength, orderLength, offcut } = measure(pieces, strip.crossCut, settings);
  const flags = strip.flags.filter((f) => f !== 'short');
  return {
    ...strip,
    pieces,
    usedLength,
    orderLength,
    offcut,
    flags: short ? ['short', ...flags] : flags,
  };
}

/**
 * Tries to empty each strip, least used first, into strips at least as wide.
 * Moves are kept only up to the point where the ordered area is smallest, and
 * only if that is smaller than before.
 */
export function fillNarrower(strips: Strip[], settings: Settings): Strip[] {
  const content = strips.map((s) => s.pieces.slice());
  const families = strips.map(family);
  let improved = true;

  while (improved) {
    improved = false;
    const donors = strips
      .map((_, i) => i)
      .filter((i) => families[i] !== null && content[i]!.length > 0)
      .sort((a, b) => area(strips[a]!, content[a]!, settings) - area(strips[b]!, content[b]!, settings));

    for (const donor of donors) {
      const trial = content.map((pieces) => pieces.slice());
      let delta = 0;
      let best = { delta: 0, content: null as StripPiece[][] | null };

      for (const piece of content[donor]!.slice().sort((a, b) => b.length - a.length)) {
        let choice: { host: number; added: number; left: number } | null = null;
        for (let host = 0; host < strips.length; host++) {
          if (host === donor || families[host] !== families[donor]) continue;
          if (trial[host]!.length === 0 || strips[host]!.stripWidth < piece.width) continue;
          const joined = [...trial[host]!, piece];
          const next = measure(joined, strips[host]!.crossCut, settings);
          if (!next.fits) continue;
          const added =
            area(strips[host]!, joined, settings) - area(strips[host]!, trial[host]!, settings);
          // Cheapest host, then the one left with the least room.
          if (!choice || added < choice.added || (added === choice.added && next.offcut < choice.left)) {
            choice = { host, added, left: next.offcut };
          }
        }
        if (!choice) continue;
        const before = area(strips[donor]!, trial[donor]!, settings);
        trial[donor]!.splice(trial[donor]!.indexOf(piece), 1);
        trial[choice.host]!.push(piece);
        delta += choice.added + area(strips[donor]!, trial[donor]!, settings) - before;
        if (delta < best.delta - 1e-6) {
          best = { delta, content: trial.map((pieces) => pieces.slice()) };
        }
      }

      if (best.content) {
        best.content.forEach((pieces, i) => (content[i] = pieces));
        improved = true;
        break;
      }
    }
  }

  return strips.flatMap((strip, i) => {
    const pieces = content[i]!;
    if (pieces.length === 0) return [];
    const unchanged =
      pieces.length === strip.pieces.length && pieces.every((p, j) => p === strip.pieces[j]);
    if (unchanged) return [strip];
    return [rebuild(strip, pieces, settings)];
  });
}

/** Boards, then cut meters: lower is better. */
export type Score = [boards: number, cutLength: number];

const beats = (a: Score, b: Score) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1] - 1e-6);

/** Bounds the search, so big jobs stay responsive. */
const MERGE_TRIALS = 250;

/**
 * Joins two strips into one where the second fits whole into the leftover of an
 * equally wide or wider one, and the boards or the wholesaler's cuts improve.
 * Ordered length alone would keep two short strips apart; this is the real aim.
 * `score` rates the strips of one material and thickness.
 */
export function mergeStrips(
  strips: Strip[],
  settings: Settings,
  score: (stock: Strip[]) => Score,
): Strip[] {
  const stockKey = (s: Strip) => JSON.stringify([s.material, s.thickness]);
  let current = strips;
  let trials = 0;

  for (const stock of new Set(strips.map(stockKey))) {
    let own = current.filter((s) => stockKey(s) === stock);
    let best = score(own);
    let improved = true;
    while (improved && trials < MERGE_TRIALS) {
      improved = false;
      const pairs = own.flatMap((host) =>
        own
          .filter(
            (donor) =>
              donor !== host &&
              family(host) !== null &&
              family(host) === family(donor) &&
              host.stripWidth >= donor.stripWidth &&
              measure([...host.pieces, ...donor.pieces], host.crossCut, settings).fits,
          )
          .map((donor) => ({ host, donor })),
      );
      // The most similar widths first: least material lost to ripping.
      pairs.sort(
        (a, b) =>
          a.host.stripWidth - a.donor.stripWidth - (b.host.stripWidth - b.donor.stripWidth),
      );
      for (const { host, donor } of pairs) {
        if (++trials > MERGE_TRIALS) break;
        const joined = rebuild(host, [...host.pieces, ...donor.pieces], settings);
        const trial = own.flatMap((s) => (s === donor ? [] : [s === host ? joined : s]));
        const rated = score(trial);
        if (!beats(rated, best)) continue;
        current = current.flatMap((s) => (s === donor ? [] : [s === host ? joined : s]));
        own = trial;
        best = rated;
        improved = true;
        break;
      }
    }
  }
  return current;
}
