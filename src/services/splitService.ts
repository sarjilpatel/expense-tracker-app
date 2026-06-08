import apiClient from './apiClient';

export type SplitMember = {
  _id: string;
  name: string;
  profilePhoto?: string;
};

export type SplitEntry = {
  userId: SplitMember;
  amount: number;
  settled: boolean;
  settledAt: string | null;
};

export type Split = {
  _id: string;
  groupId: string;
  paidBy: SplitMember;
  title: string;
  totalAmount: number;
  currency: string;
  splits: SplitEntry[];
  createdAt: string;
};

export const getSplits = async (): Promise<Split[]> => {
  try {
    const response = await apiClient.get('/splits');
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const createSplit = async (data: {
  title: string;
  totalAmount: number;
  currency?: string;
  splits: Array<{ userId: string; amount: number }>;
}): Promise<Split> => {
  try {
    const response = await apiClient.post('/splits', data);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const settleSplit = async (splitId: string, userId: string): Promise<Split> => {
  try {
    const response = await apiClient.patch(`/splits/${splitId}/settle/${userId}`);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const deleteSplit = async (splitId: string): Promise<void> => {
  try {
    await apiClient.delete(`/splits/${splitId}`);
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};
