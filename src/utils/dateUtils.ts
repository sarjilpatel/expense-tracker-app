/**
 * Given a display month/year and a custom monthlyStart day,
 * returns the actual start and end Date objects for that period.
 *
 * Example: month=6, year=2026, monthlyStart=15
 *   → start = June 15 00:00:00
 *   → end   = July 14 23:59:59
 *
 * When monthlyStart=1 (default), this is just the calendar month.
 */
export function getPeriodRange(
  month: number,
  year: number,
  monthlyStart: number,
): { start: Date; end: Date } {
  if (monthlyStart <= 1) {
    return {
      start: new Date(year, month - 1, 1, 0, 0, 0, 0),
      end:   new Date(year, month,     0, 23, 59, 59, 999), // last day of month
    };
  }

  const start = new Date(year, month - 1, monthlyStart, 0, 0, 0, 0);

  // End is (monthlyStart - 1) of the following month
  const endMonth = month === 12 ? 0 : month;       // 0-based month for next month
  const endYear  = month === 12 ? year + 1 : year;
  const end = new Date(endYear, endMonth, monthlyStart - 1, 23, 59, 59, 999);

  return { start, end };
}

/**
 * Returns a short human-readable label for the custom period.
 * e.g. "Jun 15 – Jul 14" or "June 2026" if default start.
 */
export function getPeriodLabel(
  month: number,
  year: number,
  monthlyStart: number,
): string {
  if (monthlyStart <= 1) return '';   // use the existing month header

  const { start, end } = getPeriodRange(month, year, monthlyStart);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Filter an array of transactions to only those within [start, end]. */
export function filterByPeriod(
  transactions: any[],
  start: Date,
  end: Date,
): any[] {
  return transactions.filter(tx => {
    const d = new Date(tx.date ?? tx.createdAt);
    return d >= start && d <= end;
  });
}

/**
 * Returns the calendar months needed to cover a custom period.
 * For monthlyStart=15, month=6 → needs months [6, 7].
 * For monthlyStart=1 → needs only [6].
 */
export function getCalendarMonthsForPeriod(
  month: number,
  year: number,
  monthlyStart: number,
): { month: number; year: number }[] {
  if (monthlyStart <= 1) return [{ month, year }];
  // The period spans into the next calendar month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;
  return [{ month, year }, { month: nextMonth, year: nextYear }];
}
