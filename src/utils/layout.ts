/**
 * Pure layout maths for the primitives — kept out of `components/ui` so it runs under `node:test`.
 */

/**
 * Minimum hit target. Material says 48, Apple says 44; 44 satisfies both stores' review bars.
 * `Touchable` pads anything smaller up to it with hitSlop rather than resizing the visual.
 */
export const MIN_TARGET = 44;

export interface Insets { top: number; bottom: number; left: number; right: number }

/** How much hitSlop a `size`dp control needs to reach the minimum target, per side. */
export function slopFor(size?: number): Insets | undefined {
  if (!size || !Number.isFinite(size) || size >= MIN_TARGET) return undefined;
  const pad = Math.ceil((MIN_TARGET - size) / 2);
  return { top: pad, bottom: pad, left: pad, right: pad };
}
