/**
 * tripService.ts — the one shape a trip has, wherever it is stored.
 *
 * The app used to have two bill-splitting features that could not see each other: server-side
 * `splits`, group-scoped and unusable as a guest, and a local-only TripMaster whose members were
 * ad-hoc names. W2-28 merged them onto the trip model, which is the one of the two that can express
 * the other — a split is a trip with one expense, but a trip with a member who has no account
 * cannot be a split at all.
 *
 * Per the naming convention this file holds types and pure logic only. The two implementations are
 * `tripApi.ts` (remote) and `local/localTripService.ts` (AsyncStorage), and both answer with the
 * types below so a screen cannot tell which one it is talking to.
 */

export interface TripMember {
  id: string;
  name: string;
  /** The account behind this member, when there is one. An ad-hoc member has `null`. */
  userId?: string | null;
  photo?: string | null;
  /**
   * The member who *is* the device's user, on a guest trip. A guest has no `userId` to carry, and
   * without this the sync could not say which member to link to the account — the server would
   * seed a second "you" with a zero balance next to the real one, and removing the wrong duplicate
   * cascades through every expense that member paid for.
   */
  isSelf?: boolean;
}

export interface TripExpense {
  id: string;
  description: string;
  /** INTEGER minor units (paise) — see `src/utils/settlement.ts` for why this is never a float. */
  amountMinor: number;
  paidById: string;
  participantIds: string[];
  /**
   * Explicit share per member for an unevenly divided expense. When present it is the whole truth:
   * its keys are the participants and `amountMinor` is their sum.
   */
  sharesMinor?: Record<string, number>;
  createdAt: string;
}

/** A payment one member actually made to another, as opposed to one the engine suggests. */
export interface TripSettlement {
  id: string;
  fromId: string;
  toId: string;
  amountMinor: number;
  settledAt: string;
  recordedBy?: string | null;
}

export interface Trip {
  id: string;
  name: string;
  currency: string;
  members: TripMember[];
  expenses: TripExpense[];
  settlements: TripSettlement[];
  createdAt: string;
  updatedAt: string;
  /**
   * The account that owns this trip, or `null` for a trip stored on this device.
   *
   * This is also how a screen knows what it may offer: a local trip is entirely the user's, while a
   * shared one is only editable by its owner, and confirming a payment belongs to whoever received
   * it. Everything else about the two is identical.
   */
  ownerId: string | null;
  /** The group the trip belongs to once it has been through the server; null on this device only. */
  groupId?: string | null;
}

export const isLocalTrip = (trip: Trip): boolean => trip.ownerId === null;

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const int = (v: unknown): number => Math.max(0, Math.trunc(Number(v) || 0));

/** The ObjectId a populated reference carries, whether it arrived populated or not. */
const refId = (v: any): string | null =>
  v == null ? null : typeof v === 'string' ? v : (v._id ? String(v._id) : null);

function normaliseExpense(e: any, nowIso: string): TripExpense | null {
  if (!e?.id) return null;

  // A share of zero or less cannot be attributed to anyone, and one naming a non-participant is
  // how the balances would stop summing to zero — so the keys, not the declared list, win.
  let sharesMinor: Record<string, number> | undefined;
  const raw = e.sharesMinor;
  if (raw && typeof raw === 'object') {
    const entries = Object.entries(raw as Record<string, unknown>)
      .map(([k, v]) => [String(k), int(v)] as const)
      .filter(([, v]) => v > 0);
    if (entries.length) sharesMinor = Object.fromEntries(entries);
  }

  const participantIds = sharesMinor
    ? Object.keys(sharesMinor)
    : [...new Set((Array.isArray(e.participantIds) ? (e.participantIds as unknown[]) : []).map(v => String(v)))];

  return {
    id:          String(e.id),
    description: str(e.description),
    amountMinor: sharesMinor
      ? Object.values(sharesMinor).reduce((a, b) => a + b, 0)
      : int(e.amountMinor),
    paidById:    str(e.paidById),
    participantIds,
    sharesMinor,
    createdAt:   str(e.createdAt, nowIso),
  };
}

/**
 * Shapes anything trip-like into a `Trip`, whether it came from the server, from AsyncStorage, or
 * from a version of either that predates a field.
 *
 * Both stores run their reads through this, which is what keeps a trip written on a device and one
 * fetched from the server indistinguishable to the screens — including trips written before
 * `settlements` and `sharesMinor` existed.
 */
export function normaliseTrip(t: any): Trip {
  const nowIso = new Date().toISOString();

  return {
    id:       String(t?.id ?? t?._id ?? ''),
    name:     str(t?.name, 'Untitled'),
    currency: str(t?.currency, 'INR'),
    ownerId:  refId(t?.ownerId),

    members: (Array.isArray(t?.members) ? t.members : [])
      .filter((m: any) => m?.id)
      .map((m: any) => ({
        id:     String(m.id),
        name:   str(m.name),
        userId: refId(m.userId),
        photo:  m.userId && typeof m.userId === 'object' ? (m.userId.profilePhoto ?? null) : null,
        ...(m.isSelf ? { isSelf: true } : {}),
      })),

    expenses: (Array.isArray(t?.expenses) ? t.expenses : [])
      .map((e: any) => normaliseExpense(e, nowIso))
      .filter(Boolean) as TripExpense[],

    settlements: (Array.isArray(t?.settlements) ? t.settlements : [])
      .filter((s: any) => s?.id && s.fromId && s.toId)
      .map((s: any) => ({
        id:          String(s.id),
        fromId:      String(s.fromId),
        toId:        String(s.toId),
        amountMinor: int(s.amountMinor),
        settledAt:   str(s.settledAt, nowIso),
        recordedBy:  refId(s.recordedBy),
      })),

    createdAt: str(t?.createdAt, nowIso),
    updatedAt: str(t?.updatedAt, nowIso),
    groupId:   refId(t?.groupId),
  };
}

/**
 * The expenses of a trip, less what has already been paid back, in the form the settlement engine
 * takes.
 *
 * A recorded payment is modelled as an expense the sender paid on the recipient's behalf: the
 * sender is credited with it and the recipient carries the whole share, so it moves exactly
 * `amountMinor` from one balance to the other and nets to zero across the pair. That is the same
 * arithmetic as subtracting the payment from the debt, and it needs no special case in the engine —
 * which is why `settlement.ts` knows nothing about settlements having been recorded.
 */
export function toSettlementInput(trip: Trip) {
  return [
    ...trip.expenses.map(e => ({
      amountMinor:    e.amountMinor,
      paidById:       e.paidById,
      participantIds: e.participantIds,
      sharesMinor:    e.sharesMinor,
    })),
    ...trip.settlements.map(s => ({
      amountMinor:    s.amountMinor,
      paidById:       s.fromId,
      participantIds: [s.toId],
    })),
  ];
}
