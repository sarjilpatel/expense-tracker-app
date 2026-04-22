import apiClient from './apiClient';

export interface Category {
  _id: string;
  name: string;
  icon: string;
  type?: 'income' | 'expense' | 'both';
}

export const createGroup = async (groupName: string) => {
  try {
    const response = await apiClient.post('/group/create', { groupName });
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to create group';
  }
};

export const joinGroup = async (inviteCode: string) => {
  try {
    const response = await apiClient.post('/group/join', { inviteCode });
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Invalid invite code';
  }
};

export const getCurrentGroup = async () => {
  try {
    const response = await apiClient.get('/group/details');
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
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to switch group';
  }
};

export const addCategory = async (name: string, icon: string, type: 'income' | 'expense' | 'both' = 'expense') => {
  try {
    const response = await apiClient.post('/group/categories', { name, icon, type });
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to add category';
  }
};

export const removeCategory = async (categoryId: string) => {
  try {
    const response = await apiClient.delete(`/group/categories/${categoryId}`);
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to remove category';
  }
};

export const importCategories = async (fromGroupId: string, type?: string) => {
  try {
    const response = await apiClient.post('/group/categories/import', { fromGroupId, type });
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to import categories';
  }
};

export const setupWeddingPreset = async () => {
  try {
    const response = await apiClient.post('/group/categories/wedding-preset');
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to setup wedding categories';
  }
};
