/** Half-up rounding that tolerates binary noise such as 1.005 * 100 = 100.4999… */
export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor + 1e-7) / factor;
}
