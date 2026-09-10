import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import socketService from '../services/socketService';
import { requestNotificationPermissions } from '../services/notificationService';
import { setMode as setDataMode } from '../services/dataService';
import { clearAllUserCaches } from '../cache/transactionCache';
import { logoutUser, syncDeviceTimezone } from '../services/authApi';

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
  login: (token: string, user: User, refreshToken?: string) => Promise<void>;
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
        const storedToken = await SecureStore.getItemAsync('token');
        const storedUser  = await SecureStore.getItemAsync('user');

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

  // Device time zone (W1-30). `User.timezone` tells the server which calendar to fire this user's
  // recurring transactions in, and was written once at signup — a user who moved kept firing on
  // their old day with nothing in the app able to correct it. Keyed on the user id so it runs once
  // per signed-in session: on a start with stored credentials, and again on a fresh login. The
  // local copy is updated too, so the next start has nothing to send.
  useEffect(() => {
    if (!user || !token || isGuest) return;
    syncDeviceTimezone(user.timezone).then(zone => { if (zone) updateUser({ timezone: zone }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, token, isGuest]);

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

  const login = async (newToken: string, newUser: User, newRefreshToken?: string) => {
    try {
      await SecureStore.setItemAsync('token', newToken);
      await SecureStore.setItemAsync('user', JSON.stringify(newUser));
      if (newRefreshToken) await SecureStore.setItemAsync('refreshToken', newRefreshToken);
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
    // Revoke server-side first, while the token is still in SecureStore for apiClient to send.
    // Best-effort: a failure here must not strand the user in a logged-in UI, so the local
    // teardown below runs either way. apiClient also calls this on a failed refresh, where the
    // request is expected to fail.
    try {
      await logoutUser();
    } catch {
      // offline, or the token was already invalid — nothing more to revoke
    }
    try {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('user');
      setToken(null);
      setUser(null);
      setIsGuest(true);
      setDataMode(true);
      socketService.disconnect();
      await clearAllUserCaches();
    } catch (error) {
      console.error('Error during logout storage:', error);
    }
  };

  const updateUser = async (updatedData: Partial<User>) => {
    try {
      if (!user) return;
      const mergedUser = { ...user, ...updatedData };
      await SecureStore.setItemAsync('user', JSON.stringify(mergedUser));
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
