import { describe, expect, it } from 'vitest';
import { binPack } from './binpack';

/** Fewest bins by trying every assignment. */
function bruteForce(sizes: number[], capacity: number): number {
  let best = sizes.length;
  const loads: number[] = [];
  const place = (i: number) => {
    if (loads.length > best) return;
    if (i === sizes.length) {
      best = Math.min(best, loads.length);
      return;
    }
    for (let bin = 0; bin < loads.length; bin++) {
      if (loads[bin]! + sizes[i]! > capacity) continue;
      loads[bin]! += sizes[i]!;
      place(i + 1);
      loads[bin]! -= sizes[i]!;
    }
    loads.push(sizes[i]!);
    place(i + 1);
    loads.pop();
  };
  place(0);
  return best;
}

describe('binPack', () => {
  it('beats First Fit Decreasing', () => {
    // FFD needs 3 bins: [5,4] [4,3,3] [3].  Optimal: [5,3,3] [4,4,3].
    const { bins, proven } = binPack([5, 4, 4, 3, 3, 3], 11, () => 1);
    expect(bins).toHaveLength(2);
    expect(proven).toBe(true);
  });

  it('matches brute force on random jobs and places every item once', () => {
    let seed = 1;
    const random = (n: number) => (seed = (seed * 48271) % 2147483647) % n;
    for (let run = 0; run < 300; run++) {
      const sizes = Array.from({ length: 1 + random(8) }, () => 10 + random(80)).sort(
        (a, b) => b - a,
      );
      const { bins, proven } = binPack(sizes, 100, () => 1);
      expect(proven).toBe(true);
      expect(bins.length).toBe(bruteForce(sizes, 100));
      expect(bins.flat().sort((a, b) => a - b)).toEqual(sizes.map((_, i) => i));
      for (const bin of bins) {
        expect(bin.reduce((sum, i) => sum + sizes[i]!, 0)).toBeLessThanOrEqual(100);
      }
    }
  });

  it('stays correct and says so when the search budget runs out', () => {
    const sizes = Array.from({ length: 300 }, (_, i) => 600 - i);
    const { bins, proven } = binPack(sizes, 1000, () => 1, 1000);
    expect(proven).toBe(false);
    expect(bins.flat()).toHaveLength(300);
  });

  it('prefers the cheaper layout among those with the fewest bins', () => {
    // First Fit gives [50,40] [35,25]; only [50,25] [40,35] has the cheap loads.
    const { bins } = binPack([50, 40, 35, 25], 100, (load) => (load === 75 ? 0 : 1));
    expect(bins).toEqual([
      [0, 3],
      [1, 2],
    ]);
  });
});
