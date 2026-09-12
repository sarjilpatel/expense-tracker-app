/**
 * Money formatting for display. Pure — no I/O, no theme — so it is testable in Node and so the
 * `Amount` primitive is a thin wrapper around one function rather than the sixth copy of this.
 *
 * The sign is the point. Income and expense used to be told apart by colour alone on the main
 * list, which is WCAG 1.4.1 (Level A) and unreadable for the ~1 in 12 men with red–green
 * deficiency (W2-24). Every rendered amount now carries `+` or `−`, and the colour is reinforcement.
 */

export type AmountKind = 'income' | 'expense' | 'neutral';

export interface FormatAmountOptions {
  /** ISO 4217 symbol to prefix. Defaults to the app-wide symbol set by `applyCurrency`. */
  symbol?: string;
  /** BCP 47 locale for digit grouping. Defaults to the app-wide locale. */
  locale?: string;
  /** Show decimals. Whole-unit currencies (JPY) pass `false`. Default `true`. */
  decimals?: boolean;
  /** Omit the sign even for income/expense — for a total whose direction the label already states. */
  unsigned?: boolean;
}

let defaultSymbol = '₹';
let defaultLocale = 'en-IN';

/** Mirrors `applyCurrency` in `constants/theme.ts` so both formatters agree on the default. */
export function setDefaultCurrency(symbol: string, locale: string): void {
  defaultSymbol = symbol;
  defaultLocale = locale;
}

/** A real minus sign, not a hyphen: it is the same width as `+` in tabular figures, so columns align. */
export const MINUS = '−';

/**
 * `1234.5` as expense → `−₹1,234.50`; as income → `+₹1,234.50`; neutral → `₹1,234.50`.
 * Negative input is treated as its magnitude — direction comes from `kind`, never from the sign
 * of the number, so a stored negative can never flip a row.
 */
export function formatAmount(amount: number, kind: AmountKind = 'neutral', opts: FormatAmountOptions = {}): string {
  const symbol   = opts.symbol ?? defaultSymbol;
  const locale   = opts.locale ?? defaultLocale;
  const decimals = opts.decimals ?? true;
  const value    = Math.abs(Number.isFinite(amount) ? amount : 0);

  const digits = value.toLocaleString(locale, {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });

  const sign = opts.unsigned || kind === 'neutral' ? '' : kind === 'expense' ? MINUS : '+';
  return `${sign}${symbol}${digits}`;
}

/** Minor units (paise) → the same string. The trip model stores integers; the screen shows money. */
export function formatMinorAmount(minor: number, kind: AmountKind = 'neutral', opts: FormatAmountOptions = {}): string {
  return formatAmount((Number.isFinite(minor) ? minor : 0) / 100, kind, opts);
}

/**
 * Compact form for chart axes and tight chips: `₹1.2K`, `₹3.4L` (Indian grouping when the locale
 * is Indian), `$1.2M`. Unsigned by design — an axis has no direction.
 */
export function formatCompactAmount(amount: number, opts: Pick<FormatAmountOptions, 'symbol' | 'locale'> = {}): string {
  const symbol = opts.symbol ?? defaultSymbol;
  const locale = opts.locale ?? defaultLocale;
  const value  = Math.abs(Number.isFinite(amount) ? amount : 0);
  const indian = locale.toLowerCase().endsWith('-in');

  const one = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

  if (indian) {
    if (value >= 1e7) return `${symbol}${one(value / 1e7)}Cr`;
    if (value >= 1e5) return `${symbol}${one(value / 1e5)}L`;
  } else {
    if (value >= 1e9) return `${symbol}${one(value / 1e9)}B`;
    if (value >= 1e6) return `${symbol}${one(value / 1e6)}M`;
  }
  if (value >= 1e3) return `${symbol}${one(value / 1e3)}K`;
  return `${symbol}${one(value)}`;
}
