// Remote accounts for signed-in users. Mirrors src/services/local/localAccountService.ts one for
// one so dataService can switch between them without the screens noticing.

import apiClient, { LONG_TIMEOUT_MS } from './apiClient';
import type { Account } from './accountService';

export const getAccounts = async (): Promise<Account[]> => {
  try {
    const { data } = await apiClient.get('/accounts');
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const saveAccount = async (
  data: Omit<Account, 'id' | 'createdAt'> & { id?: string }
): Promise<Account> => {
  try {
    const { id, ...body } = data;
    const { data: saved } = id
      ? await apiClient.put(`/accounts/${id}`, body)
      : await apiClient.post('/accounts', body);
    return saved;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const deleteAccount = async (id: string): Promise<void> => {
  try {
    await apiClient.delete(`/accounts/${id}`);
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const getTxAccountMap = async (): Promise<Record<string, string>> => {
  try {
    const { data } = await apiClient.get('/accounts/tx-map');
    return data && typeof data === 'object' ? data : {};
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const setTxAccount = async (txId: string, accountId: string): Promise<void> => {
  try {
    await apiClient.patch(`/accounts/tx/${txId}`, { accountId });
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const removeTxAccount = async (txId: string): Promise<void> => {
  try {
    // null, not a delete — the transaction stays, it just stops being filed under an account.
    await apiClient.patch(`/accounts/tx/${txId}`, { accountId: null });
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

/** Bulk create during guest→server sync. `idMap` maps each guest account id to its new server id. */
export const importAccounts = async (
  accounts: Account[]
): Promise<{ imported: number; received: number; idMap: Record<string, string> }> => {
  try {
    const { data } = await apiClient.post('/accounts/import', { accounts },
      { timeout: LONG_TIMEOUT_MS });
    return { imported: data?.imported ?? 0, received: data?.received ?? 0, idMap: data?.idMap ?? {} };
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};
