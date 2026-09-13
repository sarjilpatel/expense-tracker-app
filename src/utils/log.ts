/**
 * The one place a caught error is written down. In development it goes to the console; in a
 * release build it goes nowhere — 25 `console.*` calls on the hot path were pure noise there
 * (W2-18). When a crash reporter is added it plugs in here, not in 23 catch blocks.
 */
export function reportError(...args: unknown[]): void {
  if (__DEV__) console.error(...args);
}

export function debugLog(...args: unknown[]): void {
  if (__DEV__) console.log(...args);
}
