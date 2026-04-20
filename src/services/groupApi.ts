import apiClient from './apiClient';

export const createGroup = async (groupName) => {
  try {
    const response = await apiClient.post('/group/create', { groupName });
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || 'Failed to create group';
  }
};

export const joinGroup = async (inviteCode) => {
  try {
    const response = await apiClient.post('/group/join', { inviteCode });
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || 'Invalid invite code';
  }
};

export const getCurrentGroup = async () => {
  try {
    const response = await apiClient.get('/group/details');
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || 'Failed to fetch group details';
  }
};

export const getMyGroups = async () => {
  try {
    const response = await apiClient.get('/group/my-groups');
    return response.data; // List of all groups user is in
  } catch (error) {
    throw error.response?.data?.message || 'Failed to fetch your groups';
  }
};

export const switchGroup = async (groupId) => {
  try {
    const response = await apiClient.post('/group/switch', { groupId });
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || 'Failed to switch group';
  }
};
