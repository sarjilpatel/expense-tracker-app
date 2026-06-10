import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const PIN_HASH_KEY  = 'lock_pin_hash';
const ENABLED_KEY   = 'lock_enabled';
const SALT_KEY      = 'lock_pin_salt';
const BIOMETRIC_KEY = 'lock_biometric_enabled';
const BG_TIME_KEY   = '@lock_bg_time';
const LOCK_TIMEOUT  = 5 * 60 * 1000; // 5 minutes

async function getOrCreateSalt(): Promise<string> {
  let salt = await SecureStore.getItemAsync(SALT_KEY);
  if (!salt) {
    salt = Crypto.randomUUID();
    await SecureStore.setItemAsync(SALT_KEY, salt);
  }
  return salt;
}

async function hashPin(pin: string): Promise<string> {
  const salt = await getOrCreateSalt();
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin + salt);
}

export async function setPin(pin: string): Promise<void> {
  const hash = await hashPin(pin);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
  await SecureStore.setItemAsync(ENABLED_KEY, 'true');
}

export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  if (!storedHash) return false;
  const hash = await hashPin(pin);
  return hash === storedHash;
}

export async function isLockEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(ENABLED_KEY);
  return val === 'true';
}

export async function disableLock(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  await SecureStore.deleteItemAsync(ENABLED_KEY);
  await SecureStore.deleteItemAsync(SALT_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
}

export async function recordBackground(): Promise<void> {
  await AsyncStorage.setItem(BG_TIME_KEY, Date.now().toString());
}

export async function shouldLock(): Promise<boolean> {
  if (!(await isLockEnabled())) return false;
  const raw = await AsyncStorage.getItem(BG_TIME_KEY);
  if (!raw) return true; // cold start with lock enabled → always lock
  return Date.now() - parseInt(raw) > LOCK_TIMEOUT;
}

export async function clearBackgroundTime(): Promise<void> {
  await AsyncStorage.removeItem(BG_TIME_KEY);
}

// ── Biometric ─────────────────────────────────────────────────────────────────

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const [hw, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hw && enrolled;
  } catch {
    return false;
  }
}

export async function getBiometricEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(BIOMETRIC_KEY);
  return val === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? 'true' : 'false');
}

export async function authenticateWithBiometric(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Expense Tracker',
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
    });
    return result.success;
  } catch {
    return false;
  }
}
