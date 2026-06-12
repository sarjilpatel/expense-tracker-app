/**
 * settlement.ts — pure, dependency-free settlement engine for TripMaster.
 *
 * DESIGN PRINCIPLE: all money is handled as INTEGER minor units (e.g. paise / cents).
 * Floating-point rupees are never accumulated, so there is no rounding drift —
 * the sum of every member's share always equals the expense total exactly, and
 * every member's net balance sums to exactly zero. This is what makes the
 * settlement provably correct for all inputs.
 *
 * Convert a user-entered decimal amount to minor units with `toMinorUnits()`
 * (at the input boundary) and back with `fromMinorUnits()` (at the display
 * boundary). Everything in between is integers.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface SettlementMember {
  id: string;
  name: string;
}

export interface SettlementExpense {
  /** Amount in INTEGER minor units (paise). Must be >= 0. */
  amountMinor: number;
  /** Member id of the payer. */
  paidById: string;
  /** Member ids sharing this expense. Empty array → expense is ignored. */
  participantIds: string[];
}

/** Per-member computed standing for a trip. */
export interface MemberBalance {
  id: string;
  name: string;
  /** Total this member paid out, minor units. */
  paidMinor: number;
  /** Total this member's share of all expenses, minor units. */
  shareMinor: number;
  /** paidMinor - shareMinor. > 0 ⇒ should receive; < 0 ⇒ owes. */
  netMinor: number;
}

/** A single "who pays whom" instruction. */
export interface Transfer {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amountMinor: number;
}

export interface SettlementResult {
  totalSpentMinor: number;
  balances: MemberBalance[];
  transfers: Transfer[];
}

// ── Money conversion helpers ────────────────────────────────────────────────

/**
 * Convert a user-entered amount (rupees, possibly decimal) to integer minor
 * units. Uses rounding to the nearest paisa to absorb float representation
 * error (e.g. 0.1 + 0.2). Returns 0 for non-finite / negative input.
 */
export function toMinorUnits(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

/** Convert integer minor units back to a major-unit number (rupees). */
export function fromMinorUnits(minor: number): number {
  return minor / 100;
}

/**
 * Format integer minor units as a display string with a currency symbol.
 * Shows decimals only when the amount is not a whole major unit, and groups
 * with the Indian numbering system by default.
 */
export function formatMinor(
  minor: number,
  symbol: string = '₹',
  locale: string = 'en-IN',
): string {
  const major = fromMinorUnits(Math.abs(minor));
  const hasFraction = Math.abs(minor) % 100 !== 0;
  const text = major.toLocaleString(locale, {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
  const sign = minor < 0 ? '-' : '';
  return `${sign}${symbol}${text}`;
}

// ── Core algorithm ───────────────────────────────────────────────────────────

/**
 * Split an integer amount into `n` shares that are as equal as possible and
 * sum EXACTLY to `amount`. The first `remainder` shares get one extra minor
 * unit, so e.g. splitEvenly(1000, 3) === [334, 333, 333] (sum 1000).
 *
 * Guarantees:
 *  - shares.length === n
 *  - shares.reduce(sum) === amount   (for amount >= 0, n >= 1)
 *  - every share >= 0, and max-min <= 1
 */
export function splitEvenly(amount: number, n: number): number[] {
  if (n <= 0) return [];
  const safeAmount = Math.max(0, Math.trunc(amount));
  const base = Math.floor(safeAmount / n);
  const remainder = safeAmount - base * n; // 0 <= remainder < n
  const shares = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    shares[i] = base + (i < remainder ? 1 : 0);
  }
  return shares;
}

/**
 * Compute each member's net balance for a trip.
 *
 * For every expense the amount is split evenly (to the paisa) across its
 * participants and added to each participant's share; the full amount is
 * credited to the payer's "paid" total. A member's net = paid - share.
 *
 * The returned balances always sum to exactly zero (in minor units), because
 * for each expense both the total credited (to payer) and the total shared
 * (across participants) equal the same integer amount.
 *
 * Defensive handling:
 *  - expenses with no participants, non-positive amount, or an unknown payer
 *    are skipped (they cannot be attributed meaningfully).
 *  - participant ids not present in `members` are ignored.
 *  - duplicate participant ids within one expense are de-duplicated.
 */
export function computeBalances(
  members: SettlementMember[],
  expenses: SettlementExpense[],
): MemberBalance[] {
  const paid = new Map<string, number>();
  const share = new Map<string, number>();
  const known = new Set(members.map(m => m.id));
  for (const m of members) {
    paid.set(m.id, 0);
    share.set(m.id, 0);
  }

  for (const exp of expenses) {
    const amount = Math.trunc(exp.amountMinor);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (!known.has(exp.paidById)) continue;

    // De-duplicate participants and keep only known members.
    const participants: string[] = [];
    const seen = new Set<string>();
    for (const pid of exp.participantIds) {
      if (known.has(pid) && !seen.has(pid)) {
        seen.add(pid);
        participants.push(pid);
      }
    }
    if (participants.length === 0) continue;

    // Credit the payer with the full amount.
    paid.set(exp.paidById, (paid.get(exp.paidById) ?? 0) + amount);

    // Distribute the shares exactly.
    const shares = splitEvenly(amount, participants.length);
    for (let i = 0; i < participants.length; i++) {
      const pid = participants[i];
      share.set(pid, (share.get(pid) ?? 0) + shares[i]);
    }
  }

  return members.map(m => {
    const p = paid.get(m.id) ?? 0;
    const s = share.get(m.id) ?? 0;
    return { id: m.id, name: m.name, paidMinor: p, shareMinor: s, netMinor: p - s };
  });
}

/**
 * Greedy minimum-cash-flow settlement.
 *
 * Repeatedly matches the member who is owed the most (largest positive net)
 * with the member who owes the most (largest negative net) and transfers the
 * smaller of the two magnitudes. Produces a valid settlement that:
 *  - clears every balance to zero,
 *  - uses at most (N - 1) transfers,
 *  - emits no zero-amount transfers.
 *
 * Determinism: ties are broken by member id so the same input always yields
 * the same output. (Finding the provably minimum number of transfers is
 * NP-hard; this greedy heuristic is the standard, correct approach and is
 * optimal or near-optimal for the small groups TripMaster targets.)
 */
export function settleBalances(balances: MemberBalance[]): Transfer[] {
  const nameById = new Map(balances.map(b => [b.id, b.name]));

  // Work on copies so the caller's data is untouched.
  const debtors = balances
    .filter(b => b.netMinor < 0)
    .map(b => ({ id: b.id, amount: -b.netMinor })) // amount owed (positive)
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const creditors = balances
    .filter(b => b.netMinor > 0)
    .map(b => ({ id: b.id, amount: b.netMinor }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const transfers: Transfer[] = [];
  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di];
    const creditor = creditors[ci];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0) {
      transfers.push({
        fromId: debtor.id,
        fromName: nameById.get(debtor.id) ?? '',
        toId: creditor.id,
        toName: nameById.get(creditor.id) ?? '',
        amountMinor: amount,
      });
      debtor.amount -= amount;
      creditor.amount -= amount;
    }

    // Advance whichever side is now cleared. Using a tiny epsilon-free integer
    // compare since everything is integers.
    if (debtor.amount === 0) di++;
    if (creditor.amount === 0) ci++;
  }

  return transfers;
}

/**
 * Full settlement for a trip: totals, per-member balances, and the list of
 * transfers needed to settle up. This is the single entry point screens use.
 */
export function computeSettlement(
  members: SettlementMember[],
  expenses: SettlementExpense[],
): SettlementResult {
  const balances = computeBalances(members, expenses);
  const transfers = settleBalances(balances);
  const totalSpentMinor = balances.reduce((sum, b) => sum + b.paidMinor, 0);
  return { totalSpentMinor, balances, transfers };
}
