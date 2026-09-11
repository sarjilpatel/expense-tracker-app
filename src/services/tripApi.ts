import apiClient from './apiClient';
import { normaliseTrip, type Trip } from './tripService';

/**
 * Remote half of the trip feature. The local half is `local/localTripService.ts` and the two are
 * chosen between in `dataService.ts`; both answer with the same `Trip`, normalised through
 * `tripService.normaliseTrip`, so nothing above them can tell which one it reached.
 *
 * Every mutation returns the whole trip rather than the row it changed. A trip is one document on
 * the server and one entry in AsyncStorage, and its balances are a function of all of it — handing
 * back the piece that moved would make every caller re-fetch anyway.
 */

const unwrap = (error: any) => error.response?.data?.message || error.message || 'Something went wrong';

export const getTrips = async (): Promise<Trip[]> => {
  try {
    const { data } = await apiClient.get('/trips');
    return (Array.isArray(data) ? data : []).map(normaliseTrip);
  } catch (error: any) {
    throw unwrap(error);
  }
};

export const getTrip = async (id: string): Promise<Trip | null> => {
  try {
    const { data } = await apiClient.get(`/trips/${id}`);
    return normaliseTrip(data);
  } catch (error: any) {
    if (error.response?.status === 404) return null;
    throw unwrap(error);
  }
};

export const createTrip = async (data: {
  name: string;
  currency?: string;
  // A member id may be supplied, and the server keeps it. That is what lets `syncService` push a
  // guest's whole trip: the expenses it uploads next still name their payer and participants by the
  // ids the device gave them, so nothing has to be remapped on the way up.
  members?: Array<{ id?: string; name: string; userId?: string | null }>;
}): Promise<Trip> => {
  try {
    const res = await apiClient.post('/trips', data);
    return normaliseTrip(res.data);
  } catch (error: any) {
    throw unwrap(error);
  }
};

export const renameTrip = async (id: string, name: string): Promise<Trip> => {
  try {
    const { data } = await apiClient.patch(`/trips/${id}`, { name });
    return normaliseTrip(data);
  } catch (error: any) {
    throw unwrap(error);
  }
};

export const deleteTrip = async (id: string): Promise<void> => {
  try {
    await apiClient.delete(`/trips/${id}`);
  } catch (error: any) {
    throw unwrap(error);
  }
};

export const addMember = async (tripId: string, name: string, userId?: string | null): Promise<Trip> => {
  try {
    const { data } = await apiClient.post(`/trips/${tripId}/members`, { name, userId });
    return normaliseTrip(data);
  } catch (error: any) {
    throw unwrap(error);
  }
};

export const renameMember = async (tripId: string, memberId: string, name: string): Promise<Trip> => {
  try {
    const { data } = await apiClient.patch(`/trips/${tripId}/members/${memberId}`, { name });
    return normaliseTrip(data);
  } catch (error: any) {
    throw unwrap(error);
  }
};

export const removeMember = async (tripId: string, memberId: string): Promise<Trip> => {
  try {
    const { data } = await apiClient.delete(`/trips/${tripId}/members/${memberId}`);
    return normaliseTrip(data);
  } catch (error: any) {
    throw unwrap(error);
  }
};

export interface ExpenseInput {
  description: string;
  amountMinor: number;
  paidById: string;
  participantIds: string[];
  /** Present only for an uneven split; it then replaces both fields above as the source of truth. */
  sharesMinor?: Record<string, number> | null;
}

export const addExpense = async (tripId: string, data: ExpenseInput): Promise<Trip> => {
  try {
    const res = await apiClient.post(`/trips/${tripId}/expenses`, data);
    return normaliseTrip(res.data);
  } catch (error: any) {
    throw unwrap(error);
  }
};

export const updateExpense = async (tripId: string, expenseId: string, data: ExpenseInput): Promise<Trip> => {
  try {
    // `sharesMinor: null` rather than an omitted key: a PATCH merges onto the stored expense, so
    // leaving it out would keep the old shares and the expense would go on dividing itself by them.
    const res = await apiClient.patch(`/trips/${tripId}/expenses/${expenseId}`, {
      ...data,
      sharesMinor: data.sharesMinor ?? null,
    });
    return normaliseTrip(res.data);
  } catch (error: any) {
    throw unwrap(error);
  }
};

export const deleteExpense = async (tripId: string, expenseId: string): Promise<Trip> => {
  try {
    const { data } = await apiClient.delete(`/trips/${tripId}/expenses/${expenseId}`);
    return normaliseTrip(data);
  } catch (error: any) {
    throw unwrap(error);
  }
};

export const recordSettlement = async (
  tripId: string,
  data: { fromId: string; toId: string; amountMinor: number },
): Promise<Trip> => {
  try {
    const res = await apiClient.post(`/trips/${tripId}/settlements`, data);
    return normaliseTrip(res.data);
  } catch (error: any) {
    throw unwrap(error);
  }
};

/** Undoes a recorded payment. Same rule as recording one: it belongs to whoever was paid. */
export const deleteSettlement = async (tripId: string, settlementId: string): Promise<Trip> => {
  try {
    const { data } = await apiClient.delete(`/trips/${tripId}/settlements/${settlementId}`);
    return normaliseTrip(data);
  } catch (error: any) {
    throw unwrap(error);
  }
};
