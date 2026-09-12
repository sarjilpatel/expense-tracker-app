/**
 * The colours a user can *choose* — an account's, a goal's, the accent — and the fixed palettes
 * that colour things by identity rather than by meaning (trip members, the More tiles).
 *
 * These are data, not styling, which is why they are written down here rather than derived from
 * the theme: an account keeps its navy whether the scheme is light or dark. Everything drawn *on*
 * one of these still goes through `getContrastText`, never a hand-written foreground (W2-01).
 * `constants/` is the one place the token lint rule (W2-23) allows a hex literal.
 */

/** Deep, desaturated identities for accounts and goals — readable under white text in both schemes. */
export const IDENTITY_COLORS: string[] = [
  '#18181B', // graphite
  '#1E3A5F', // navy
  '#134E4A', // teal
  '#14532D', // forest
  '#4C1D95', // plum
  '#7C2D12', // rust
  '#92400E', // amber
  '#881337', // rose
  '#374151', // slate
  '#6B7280', // grey
  '#0F4C75', // deep blue
  '#3B4F6B', // denim
];

export const ACCOUNT_COLORS = IDENTITY_COLORS;
export const GOAL_COLORS    = IDENTITY_COLORS.slice(0, 10);

/** Trip member avatars — brighter than the identity set because they sit on a card, not under text. */
export const AVATAR_PALETTE: string[] = [
  '#5856D6', '#FF6B6B', '#4ECDC4', '#45B7D1', '#F9CA24',
  '#6C5CE7', '#00B894', '#E17055', '#A29BFE', '#FD79A8',
];

export function avatarColor(index: number): string {
  return AVATAR_PALETTE[index % AVATAR_PALETTE.length];
}

/** The accent swatches on the customization screen. */
export const ACCENT_COLORS = [
  { label: 'Graphite', value: '#18181B' }, // default — zinc-950
  { label: 'Slate',    value: '#475569' }, // slate-600 — neutral with blue character
  { label: 'Indigo',   value: '#4F46E5' }, // indigo-600 — classic indigo
  { label: 'Ocean',    value: '#1D4ED8' }, // blue-700 — rich blue
  { label: 'Teal',     value: '#0F766E' }, // teal-700 — deep teal
  { label: 'Forest',   value: '#15803D' }, // green-700 — forest green
  { label: 'Dusk',     value: '#6D28D9' }, // violet-700 — deep violet
  { label: 'Rose',     value: '#BE185D' }, // pink-700 — deep rose
  { label: 'Ember',    value: '#C2410C' }, // orange-700 — burnt orange
  { label: 'Cloud',    value: '#E5E7EB' }, // light — reversed feel
];

export const INCOME_COLORS  = [{ label: 'Blue', value: '#1999FC' }] as const;
export const EXPENSE_COLORS = [{ label: 'Red',  value: '#F55345' }] as const;

/**
 * The More screen's tiles. Each carries a category colour rather than the accent — W2-29 keeps the
 * accent for actions, and six accent tiles would read as six primary buttons.
 */
export const TILE_COLORS = {
  customize:  '#6366F1',
  accounts:   '#10B981',
  categories: '#F59E0B',
  security:   '#3B82F6',
  data:       '#0F766E',
  help:       '#71717A',
} as const;
