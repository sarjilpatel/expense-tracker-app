/**
 * tripMasterService.ts — local-first storage for the TripMaster feature.
 *
 * All data lives on-device in AsyncStorage, so TripMaster works identically
 * whether the user is logged in, a guest, or fully offline. Amounts are stored
 * as INTEGER minor units (paise) to keep the settlement math exact — see
 * src/utils/settlement.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@trip_master_v1';

export interface TripMember {
  id: string;
  name: string;
}

export interface TripExpense {
  id: string;
  description: string;
  /** Amount in INTEGER minor units (paise). */
  amountMinor: number;
  /** Member id of who paid. */
  paidById: string;
  /** Member ids sharing this expense (>= 1). */
  participantIds: string[];
  createdAt: string;
}

export interface Trip {
  id: string;
  name: string;
  currency: string;
  members: TripMember[];
  expenses: TripExpense[];
  createdAt: string;
  updatedAt: string;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function nowIso(): string {
  return new Date().toISOString();
}

async function loadAll(): Promise<Trip[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function persist(trips: Trip[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(trips));
}

/** Normalise a loaded trip so older/partial records never crash the UI. */
function normalise(t: any): Trip {
  return {
    id: t?.id ?? genId(),
    name: typeof t?.name === 'string' ? t.name : 'Untitled',
    currency: typeof t?.currency === 'string' ? t.currency : 'INR',
    members: Array.isArray(t?.members)
      ? t.members.filter((m: any) => m && m.id).map((m: any) => ({ id: m.id, name: String(m.name ?? '') }))
      : [],
    expenses: Array.isArray(t?.expenses)
      ? t.expenses
          .filter((e: any) => e && e.id)
          .map((e: any) => ({
            id: e.id,
            description: String(e.description ?? ''),
            amountMinor: Math.max(0, Math.trunc(Number(e.amountMinor) || 0)),
            paidById: String(e.paidById ?? ''),
            participantIds: Array.isArray(e.participantIds) ? e.participantIds.map(String) : [],
            createdAt: e.createdAt ?? nowIso(),
          }))
      : [],
    createdAt: t?.createdAt ?? nowIso(),
    updatedAt: t?.updatedAt ?? nowIso(),
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getTrips(): Promise<Trip[]> {
  const all = await loadAll();
  return all
    .map(normalise)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getTrip(id: string): Promise<Trip | null> {
  const all = await loadAll();
  const found = all.find(t => t.id === id);
  return found ? normalise(found) : null;
}

// ── Trip mutations ───────────────────────────────────────────────────────────

export async function createTrip(name: string, currency: string, members: string[] = []): Promise<Trip> {
  const all = await loadAll();
  const trip: Trip = {
    id: genId(),
    name: name.trim() || 'Untitled Trip',
    currency,
    members: members
      .map(n => n.trim())
      .filter(Boolean)
      .map(n => ({ id: genId(), name: n })),
    expenses: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  all.push(trip);
  await persist(all);
  return trip;
}

export async function renameTrip(id: string, name: string): Promise<void> {
  const all = await loadAll();
  const t = all.find(x => x.id === id);
  if (!t) return;
  t.name = name.trim() || t.name;
  t.updatedAt = nowIso();
  await persist(all);
}

export async function deleteTrip(id: string): Promise<void> {
  const all = await loadAll();
  await persist(all.filter(t => t.id !== id));
}

// ── Member mutations ─────────────────────────────────────────────────────────

export async function addMember(tripId: string, name: string): Promise<Trip | null> {
  const all = await loadAll();
  const t = all.find(x => x.id === tripId);
  if (!t) return null;
  const clean = name.trim();
  if (clean) {
    t.members.push({ id: genId(), name: clean });
    t.updatedAt = nowIso();
    await persist(all);
  }
  return normalise(t);
}

export async function renameMember(tripId: string, memberId: string, name: string): Promise<Trip | null> {
  const all = await loadAll();
  const t = all.find(x => x.id === tripId);
  if (!t) return null;
  const m = t.members.find(x => x.id === memberId);
  if (m) {
    m.name = name.trim() || m.name;
    t.updatedAt = nowIso();
    await persist(all);
  }
  return normalise(t);
}

/**
 * Remove a member. Any expense that member paid is deleted (it can no longer be
 * attributed); the member is also pulled from the participant list of every
 * other expense. If that empties an expense's participants, the expense is
 * dropped too. This keeps the data always settle-able.
 */
export async function removeMember(tripId: string, memberId: string): Promise<Trip | null> {
  const all = await loadAll();
  const t = all.find(x => x.id === tripId);
  if (!t) return null;
  t.members = t.members.filter(m => m.id !== memberId);
  t.expenses = t.expenses
    .filter(e => e.paidById !== memberId)
    .map(e => ({ ...e, participantIds: e.participantIds.filter(p => p !== memberId) }))
    .filter(e => e.participantIds.length > 0);
  t.updatedAt = nowIso();
  await persist(all);
  return normalise(t);
}

// ── Expense mutations ────────────────────────────────────────────────────────

export async function addExpense(
  tripId: string,
  data: { description: string; amountMinor: number; paidById: string; participantIds: string[] },
): Promise<Trip | null> {
  const all = await loadAll();
  const t = all.find(x => x.id === tripId);
  if (!t) return null;
  t.expenses.push({
    id: genId(),
    description: data.description.trim() || 'Expense',
    amountMinor: Math.max(0, Math.trunc(data.amountMinor)),
    paidById: data.paidById,
    participantIds: [...new Set(data.participantIds)],
    createdAt: nowIso(),
  });
  t.updatedAt = nowIso();
  await persist(all);
  return normalise(t);
}

export async function updateExpense(
  tripId: string,
  expenseId: string,
  data: { description: string; amountMinor: number; paidById: string; participantIds: string[] },
): Promise<Trip | null> {
  const all = await loadAll();
  const t = all.find(x => x.id === tripId);
  if (!t) return null;
  const e = t.expenses.find(x => x.id === expenseId);
  if (e) {
    e.description = data.description.trim() || e.description;
    e.amountMinor = Math.max(0, Math.trunc(data.amountMinor));
    e.paidById = data.paidById;
    e.participantIds = [...new Set(data.participantIds)];
    t.updatedAt = nowIso();
    await persist(all);
  }
  return normalise(t);
}

export async function deleteExpense(tripId: string, expenseId: string): Promise<Trip | null> {
  const all = await loadAll();
  const t = all.find(x => x.id === tripId);
  if (!t) return null;
  t.expenses = t.expenses.filter(e => e.id !== expenseId);
  t.updatedAt = nowIso();
  await persist(all);
  return normalise(t);
}

export async function clearAllTrips(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
