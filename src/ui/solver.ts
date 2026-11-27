// Loads HiGHS only when its algorithm is chosen: it is a few megabytes.
import wasmUrl from 'highs/runtime?url';
import type { Solver } from '../core/columns';

let loading: Promise<Solver> | null = null;

export function loadSolver(): Promise<Solver> {
  loading ??= import('highs')
    .then(({ default: load }) => load({ locateFile: () => wasmUrl }))
    .then((highs) => highs as unknown as Solver)
    .catch((error: unknown) => {
      // Allows another try after a network failure.
      loading = null;
      throw error;
    });
  return loading;
}
