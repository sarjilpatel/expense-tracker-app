/**
 * A counter that every write through `dataService` bumps (W3-03). Screens compare it against the
 * version they last fetched at to decide whether a focus needs a refetch: a return to Home
 * after adding a transaction does, a return after scrolling Insights does not. Together with
 * a stale window this is what stops every focus being a network round-trip.
 */
let version = 0;

export function bumpDataVersion(): void { version += 1; }
export function dataVersion(): number { return version; }

/** Wrap a mutating call so the version bumps once it has succeeded. */
export function mutating<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return async (...args: A) => {
    const result = await fn(...args);
    bumpDataVersion();
    return result;
  };
}
