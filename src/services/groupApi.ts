import apiClient from './apiClient';
import { getCachedGroup, setCachedGroup, invalidateCachedGroup } from '@/src/cache/transactionCache';

export interface Category {
  _id: string;
  name: string;
  icon: string;
  emoji?: string;
  type?: 'income' | 'expense' | 'both';
}

export const createGroup = async (groupName: string) => {
  try {
    const response = await apiClient.post('/group/create', { groupName });
    invalidateCachedGroup();
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to create group';
  }
};

export const joinGroup = async (inviteCode: string) => {
  try {
    const response = await apiClient.post('/group/join', { inviteCode });
    invalidateCachedGroup();
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Invalid invite code';
  }
};

export const getCurrentGroup = async () => {
  try {
    const cached = await getCachedGroup();
    if (cached) {
      // Return cache immediately, refresh in background
      apiClient.get('/group/details')
        .then(r => setCachedGroup(r.data))
        .catch(() => {});
      return cached;
    }
    const response = await apiClient.get('/group/details');
    setCachedGroup(response.data);
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to fetch group details';
  }
};

export const getMyGroups = async () => {
  try {
    const response = await apiClient.get('/group/my-groups');
    return response.data; // List of all groups user is in
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to fetch your groups';
  }
};

export const switchGroup = async (groupId: string) => {
  try {
    const response = await apiClient.post('/group/switch', { groupId });
    invalidateCachedGroup();
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to switch group';
  }
};

export const addCategory = async (name: string, icon: string, type: 'income' | 'expense' | 'both' = 'expense', emoji?: string) => {
  try {
    const response = await apiClient.post('/group/categories', { name, icon, type, ...(emoji ? { emoji } : {}) });
    invalidateCachedGroup();
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to add category';
  }
};

export const removeCategory = async (categoryId: string) => {
  try {
    const response = await apiClient.delete(`/group/categories/${categoryId}`);
    invalidateCachedGroup();
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to remove category';
  }
};

export const importCategories = async (fromGroupId: string, type?: string) => {
  try {
    const response = await apiClient.post('/group/categories/import', { fromGroupId, type });
    invalidateCachedGroup();
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to import categories';
  }
};

export const leaveGroup = async () => {
  try {
    const response = await apiClient.post('/group/leave');
    invalidateCachedGroup();
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to leave group';
  }
};

export const deleteGroup = async () => {
  try {
    const response = await apiClient.delete('/group');
    invalidateCachedGroup();
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to delete group';
  }
};
