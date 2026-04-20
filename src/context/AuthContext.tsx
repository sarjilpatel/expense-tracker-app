import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from '../services/socketService';

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
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStorageData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        const storedUser = await AsyncStorage.getItem('user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error loading auth data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStorageData();
  }, []);

  // Handle Socket connection lifecycle
  useEffect(() => {
    if (user && token) {
      socketService.connect();
      if (user.groupId) {
        socketService.joinGroup(user.groupId.toString());
      }
    } else if (!loading) {
      socketService.disconnect();
    }
  }, [user, token, loading]);

  const login = async (newToken: string, newUser: User) => {
    try {
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
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

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
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
