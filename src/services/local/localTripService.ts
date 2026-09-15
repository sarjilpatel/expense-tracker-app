/**
 * localTripService.ts — the guest half of the trip feature.
 *
 * All data lives on-device in AsyncStorage, so a trip works identically whether the user is a guest
 * or fully offline. Amounts are INTEGER minor units (paise) to keep the settlement maths exact —
 * see `src/utils/settlement.ts`.
 *
 * This is what W2-28 merged the old server-side splits into. The remote half is `tripApi.ts`, the
 * shared shape is `tripService.ts`, and `dataService.ts` picks between them. Every function here
 * answers with a `Trip` run through `normaliseTrip`, so a trip that came off this device and one
 * that came off the server are the same object to a screen — which is also what lets the sync
 * engine push a whole trip as one row without translating anything.
 */
import { getSyncMeta } from '@/src/sync/meta';
import { JsonStore } from './jsonStore';
import {
  normaliseTrip,
  type Trip,
  type TripExpense,
} from '../tripService';

const KEY = '@trip_master_v1';

export type { Trip, TripMember, TripExpense, TripSettlement } from '../tripService';

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function nowIso(): string {
  return new Date().toISOString();
}

const store = new JsonStore<Trip[]>(KEY, () => []);

async function loadAll(): Promise<Trip[]> {
  const parsed = await store.get();
  return Array.isArray(parsed) ? parsed.map(normaliseTrip) : [];
}

const persist = (trips: Trip[]) => store.set(trips);

/**
 * Loads every trip, hands `mutate` the one asked for, then persists and returns it.
 *
 * Each mutation used to repeat load / find / touch `updatedAt` / persist, and the one that forgot
 * the timestamp sorted itself to the bottom of the list for ever. There is one copy of it now.
 */
async function withTrip(id: string, mutate: (trip: Trip) => void): Promise<Trip | null> {
  const all = await loadAll();
  const trip = all.find(t => t.id === id);
  if (!trip) return null;

  mutate(trip);
  trip.updatedAt = nowIso();
  await persist(all);
  return normaliseTrip(trip);
}

// ── Queries ──────────────────────────────────────────────────────────────────

/** The active group's trips when signed in (plus any not yet pushed); everything as a guest. */
async function inScope(trips: Trip[]): Promise<Trip[]> {
  const { activeGroupId } = await getSyncMeta();
  if (!activeGroupId) return trips;
  return trips.filter(t => !t.groupId || String(t.groupId) === activeGroupId);
}

export async function getTrips(): Promise<Trip[]> {
  const all = await inScope(await loadAll());
  return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getTrip(id: string): Promise<Trip | null> {
  const all = await loadAll();
  return all.find(t => t.id === id) ?? null;
}

// ── Trip mutations ───────────────────────────────────────────────────────────

export async function createTrip(data: {
  name: string;
  currency?: string;
  members?: Array<{ id?: string; name: string; userId?: string | null }>;
}): Promise<Trip> {
  const all = await loadAll();
  const trip = normaliseTrip({
    id:       genId(),
    name:     data.name.trim() || 'Untitled Trip',
    currency: data.currency || 'INR',
    // A guest has no account, so nothing here can be linked to one — `ownerId: null` is what marks
    // a trip as this device's, and `isLocalTrip` is how the screens read it.
    ownerId:  null,
    // The device's user is always a member, as the creator always is on the server — every balance
    // is stated relative to them. `isSelf` is what lets the sync link this member to the account
    // later instead of seeding a second one beside it.
    members:  [
      { id: genId(), name: 'You', userId: null, isSelf: true },
      ...(data.members ?? [])
        .map(m => ({ id: m.id || genId(), name: m.name.trim(), userId: null }))
        .filter(m => m.name),
    ],
    expenses:    [],
    settlements: [],
    createdAt:   nowIso(),
    updatedAt:   nowIso(),
  });

  all.push(trip);
  await persist(all);
  return trip;
}

export async function renameTrip(id: string, name: string): Promise<Trip | null> {
  return withTrip(id, t => { t.name = name.trim() || t.name; });
}

export async function deleteTrip(id: string): Promise<void> {
  const all = await loadAll();
  await persist(all.filter(t => t.id !== id));
}

// ── Member mutations ─────────────────────────────────────────────────────────

export async function addMember(tripId: string, name: string): Promise<Trip | null> {
  return withTrip(tripId, t => {
    const clean = name.trim();
    if (clean) t.members.push({ id: genId(), name: clean, userId: null });
  });
}

export async function renameMember(tripId: string, memberId: string, name: string): Promise<Trip | null> {
  return withTrip(tripId, t => {
    const m = t.members.find(x => x.id === memberId);
    if (m) m.name = name.trim() || m.name;
  });
}

/**
 * Removes a member and everything that cannot survive them.
 *
 * An expense they paid for is deleted — it can no longer be attributed — and they are pulled from
 * the participants and the explicit shares of every other one; an expense that leaves empty goes
 * too, along with any payment they were a party to. That keeps the trip always settle-able, and it
 * is the same cascade `tripController.removeMember` performs on the server. The two have to agree,
 * or the same action produces different balances either side of a login.
 */
export async function removeMember(tripId: string, memberId: string): Promise<Trip | null> {
  return withTrip(tripId, t => {
    t.members  = t.members.filter(m => m.id !== memberId);
    t.expenses = t.expenses
      .filter(e => e.paidById !== memberId)
      .map(e => {
        const next: TripExpense = { ...e, participantIds: e.participantIds.filter(p => p !== memberId) };
        if (next.sharesMinor) {
          const { [memberId]: _gone, ...rest } = next.sharesMinor;
          next.sharesMinor = Object.keys(rest).length ? rest : undefined;
          next.participantIds = next.sharesMinor ? Object.keys(next.sharesMinor) : next.participantIds;
          next.amountMinor = next.sharesMinor
            ? Object.values(next.sharesMinor).reduce((a, b) => a + b, 0)
            : next.amountMinor;
        }
        return next;
      })
      .filter(e => e.participantIds.length > 0);
    t.settlements = t.settlements.filter(s => s.fromId !== memberId && s.toId !== memberId);
  });
}

// ── Expense mutations ────────────────────────────────────────────────────────

export interface ExpenseInput {
  description: string;
  amountMinor: number;
  paidById: string;
  participantIds: string[];
  sharesMinor?: Record<string, number> | null;
}

/** Shared by add and update so the two cannot disagree about what an expense is. */
function shapeExpense(id: string, data: ExpenseInput, createdAt: string): TripExpense {
  const shares = data.sharesMinor
    ? Object.fromEntries(
        Object.entries(data.sharesMinor)
          .map(([k, v]) => [k, Math.max(0, Math.trunc(v))] as const)
          .filter(([, v]) => v > 0),
      )
    : undefined;

  // With explicit shares the keys are the participants and the total is their sum: a declared total
  // that disagrees with its own shares is the one way balances stop summing to zero, so there is
  // only ever one source of truth for it.
  return {
    id,
    description:    data.description.trim() || 'Expense',
    amountMinor:    shares
      ? Object.values(shares).reduce((a, b) => a + b, 0)
      : Math.max(0, Math.trunc(data.amountMinor)),
    paidById:       data.paidById,
    participantIds: shares ? Object.keys(shares) : [...new Set(data.participantIds)],
    sharesMinor:    shares && Object.keys(shares).length ? shares : undefined,
    createdAt,
  };
}

export async function addExpense(tripId: string, data: ExpenseInput): Promise<Trip | null> {
  return withTrip(tripId, t => {
    t.expenses.push(shapeExpense(genId(), data, nowIso()));
  });
}

export async function updateExpense(tripId: string, expenseId: string, data: ExpenseInput): Promise<Trip | null> {
  return withTrip(tripId, t => {
    const i = t.expenses.findIndex(x => x.id === expenseId);
    if (i >= 0) t.expenses[i] = shapeExpense(expenseId, data, t.expenses[i].createdAt);
  });
}

export async function deleteExpense(tripId: string, expenseId: string): Promise<Trip | null> {
  return withTrip(tripId, t => {
    t.expenses = t.expenses.filter(e => e.id !== expenseId);
  });
}

// ── Settlements ──────────────────────────────────────────────────────────────

export async function recordSettlement(
  tripId: string,
  data: { fromId: string; toId: string; amountMinor: number },
): Promise<Trip | null> {
  const amountMinor = Math.max(0, Math.trunc(data.amountMinor));
  if (!amountMinor || data.fromId === data.toId) return getTrip(tripId);

  return withTrip(tripId, t => {
    t.settlements.push({ id: genId(), ...data, amountMinor, settledAt: nowIso(), recordedBy: null });
  });
}

/** Undoing a payment is deleting its record, not writing a second flag over it (W1-29). */
export async function deleteSettlement(tripId: string, settlementId: string): Promise<Trip | null> {
  return withTrip(tripId, t => {
    t.settlements = t.settlements.filter(s => s.id !== settlementId);
  });
}

export async function clearAllTrips(): Promise<void> {
  await store.clear();
}

// ── Sync support (W3) ─────────────────────────────────────────────────────────
// Rows arrive from other devices and other group members through the changes feed; the engine
// upserts them here by clientId (which *is* the local id) and removes tombstones. Reads filter on
// the active group when signed in: a row with no groupId is this device's own, not yet pushed.

export async function upsertLocalTrip(trip: Trip): Promise<void> {
  const all = await loadAll();
  const idx = all.findIndex(t => t.id === trip.id);
  if (idx === -1) all.push(trip); else all[idx] = trip;
  await persist(all);
}

export async function removeLocalTrip(id: string): Promise<void> {
  const all = await loadAll();
  const next = all.filter(t => t.id !== id);
  if (next.length !== all.length) await persist(next);
}
