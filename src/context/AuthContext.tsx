import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from '../services/socketService';
import { requestNotificationPermissions } from '../services/notificationService';
import { setMode as setDataMode } from '../services/dataService';
import { invalidateCachedGroup, invalidateCachedProfile, invalidateAllTransactionCache } from '../cache/transactionCache';

export interface User {
  _id: string;
  name: string;
  email: string;
  groupId: string | null;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isGuest: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: Partial<User>) => Promise<void>;
  enterGuestMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user,    setUser]    = useState<User | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(true);

  useEffect(() => {
    const loadStorageData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        const storedUser  = await AsyncStorage.getItem('user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          setIsGuest(false);
          setDataMode(false);
        } else {
          // No stored credentials — start in guest mode automatically
          setIsGuest(true);
          setDataMode(true);
        }
      } catch {
        setIsGuest(true);
        setDataMode(true);
      } finally {
        setLoading(false);
      }
    };

    loadStorageData();
  }, []);

  // Socket lifecycle — only for logged-in users
  useEffect(() => {
    if (user && token && !isGuest) {
      socketService.connect(token);
      if (user.groupId) {
        socketService.joinGroup(user.groupId.toString());
      }
    } else if (!loading && !user) {
      socketService.disconnect();
    }
  }, [user, token, loading, isGuest]);

  const login = async (newToken: string, newUser: User) => {
    try {
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
      setIsGuest(false);
      setDataMode(false);
      requestNotificationPermissions();
    } catch (error) {
      console.error('Error during login storage:', error);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      setToken(null);
      setUser(null);
      setIsGuest(true);
      setDataMode(true);
      socketService.disconnect();
      invalidateCachedGroup();
      invalidateCachedProfile();
      invalidateAllTransactionCache();
    } catch (error) {
      console.error('Error during logout storage:', error);
    }
  };

  const updateUser = async (updatedData: Partial<User>) => {
    try {
      if (!user) return;
      const mergedUser = { ...user, ...updatedData };
      await AsyncStorage.setItem('user', JSON.stringify(mergedUser));
      setUser(mergedUser);
    } catch (error) {
      console.error('Error updating user state:', error);
    }
  };

  const enterGuestMode = () => {
    setIsGuest(true);
    setDataMode(true);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, isGuest, login, logout, updateUser, enterGuestMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
