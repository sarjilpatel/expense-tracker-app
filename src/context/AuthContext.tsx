import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import socketService from '../services/socketService';
import { requestNotificationPermissions } from '../services/notificationService';
import { setMode as setDataMode } from '../services/dataService';
import { setSignedIn } from '@/src/sync/session';
import { getSyncMeta, updateSyncMeta, resetSyncCursor } from '@/src/sync/meta';
import { runSync } from '@/src/sync/engine';
import { applyBackgroundSchedule, noteGroupSignal } from '@/src/sync/scheduler';
import { seedOutboxFromLocal, clearLocalData } from '@/src/sync/localStore';
import { logoutUser, syncDeviceTimezone } from '../services/authApi';

import { reportError } from '@/src/utils/log';
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
        // Both reads at once — they were sequential on the critical startup path (W2-18).
        const [storedToken, storedUser] = await Promise.all([
          SecureStore.getItemAsync('token'),
          SecureStore.getItemAsync('user'),
        ]);

        if (storedToken && storedUser) {
          const stored: User = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(stored);
          setIsGuest(false);
          setDataMode(false);
          // The sync engine's view of the session (W3): who we are and which group we read for.
          setSignedIn(true);
          await updateSyncMeta({ activeGroupId: stored.groupId ? String(stored.groupId) : null });
          seedOutboxFromLocal().catch(() => {});
          applyBackgroundSchedule().catch(() => {});
        } else {
          // No stored credentials — start in guest mode automatically
          setIsGuest(true);
          setDataMode(true);
          setSignedIn(false);
        }
      } catch {
        setIsGuest(true);
        setDataMode(true);
        setSignedIn(false);
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
      // Another device in the group pushed something: pull it (W3-22). Our own push echoes
      // back through the room too and is ignored — those rows are already local.
      socketService.onGroupChanged(({ by }) => { if (by !== String(user._id)) noteGroupSignal(); });
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
      // Whatever was written as a guest is the outbox; a new device has a full pull to do. Both
      // are one call — the engine pushes first, then pulls from the (empty) cursor (W3-19).
      setSignedIn(true);
      await updateSyncMeta({ activeGroupId: newUser.groupId ? String(newUser.groupId) : null });
      await seedOutboxFromLocal().catch(() => {});
      runSync('login').catch(() => {});
      applyBackgroundSchedule().catch(() => {});
    } catch (error) {
      reportError('Error during login storage:', error);
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
      // The data is on the server (the caller confirmed anything still waiting — see settings);
      // the device starts over as a guest with nothing of this account left on it.
      setSignedIn(false);
      await applyBackgroundSchedule().catch(() => {});
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('user');
      setToken(null);
      setUser(null);
      setIsGuest(true);
      setDataMode(true);
      socketService.disconnect();
      await clearLocalData();
    } catch (error) {
      reportError('Error during logout storage:', error);
    }
  };

  const updateUser = async (updatedData: Partial<User>) => {
    try {
      if (!user) return;
      const mergedUser = { ...user, ...updatedData };
      await SecureStore.setItemAsync('user', JSON.stringify(mergedUser));
      setUser(mergedUser);
      // A group change means a different set of rows: the local reads now filter on the new
      // group, and the cursor is reset so the next run pulls that group in full — the changes
      // feed is not group-versioned (W3, Stage 1 note).
      if ('groupId' in updatedData) {
        const next = mergedUser.groupId ? String(mergedUser.groupId) : null;
        const { activeGroupId } = await getSyncMeta();
        if (next !== activeGroupId) {
          await updateSyncMeta({ activeGroupId: next });
          await resetSyncCursor();
          runSync('restore').catch(() => {});
        }
      }
    } catch (error) {
      reportError('Error updating user state:', error);
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
