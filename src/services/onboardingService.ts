import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether the first-run flow (`app/welcome.tsx`, W2-32) has been completed on this device. Kept
 * on the device rather than the account on purpose: the flow sets device things — currency,
 * theme, starter categories — and a returning user on a new phone should see it again.
 */
const KEY = '@welcome_seen_v1';

export async function hasSeenWelcome(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY)) === 'true'; }
  catch { return true; }   // a storage failure must never trap the user on the welcome screen
}

export async function markWelcomeSeen(): Promise<void> {
  try { await AsyncStorage.setItem(KEY, 'true'); } catch {}
}
