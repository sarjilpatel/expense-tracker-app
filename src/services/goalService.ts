import apiClient from './apiClient';

export type Goal = {
  _id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string | null;
  icon: string;
  color: string;
  groupId: string;
  userId: string;
  createdAt: string;
};

export const getGoals = async (): Promise<Goal[]> => {
  try {
    const response = await apiClient.get('/goals');
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const createGoal = async (data: {
  name: string;
  targetAmount: number;
  savedAmount?: number;
  deadline?: string | null;
  icon?: string;
  color?: string;
}): Promise<Goal> => {
  try {
    const response = await apiClient.post('/goals', data);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const updateGoal = async (
  id: string,
  data: Partial<{ name: string; targetAmount: number; savedAmount: number; deadline: string | null; icon: string; color: string; addAmount: number }>,
): Promise<Goal> => {
  try {
    const response = await apiClient.put(`/goals/${id}`, data);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const deleteGoal = async (id: string): Promise<void> => {
  try {
    await apiClient.delete(`/goals/${id}`);
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};
