import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const PIN_KEY      = '@lock_pin_hash';
const ENABLED_KEY  = '@lock_enabled';
const BG_TIME_KEY  = '@lock_bg_time';
const SALT_KEY     = 'lock_pin_salt'; // SecureStore key (hardware-backed)
const LOCK_TIMEOUT = 30_000; // 30 seconds in background triggers lock

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
  await AsyncStorage.multiSet([[PIN_KEY, hash], [ENABLED_KEY, 'true']]);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const [[, storedHash]] = await AsyncStorage.multiGet([PIN_KEY]);
  if (!storedHash) return false;
  const hash = await hashPin(pin);
  return hash === storedHash;
}

export async function isLockEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(ENABLED_KEY);
  return val === 'true';
}

export async function disableLock(): Promise<void> {
  await AsyncStorage.multiRemove([PIN_KEY, ENABLED_KEY]);
  await SecureStore.deleteItemAsync(SALT_KEY);
}

export async function recordBackground(): Promise<void> {
  await AsyncStorage.setItem(BG_TIME_KEY, Date.now().toString());
}

export async function shouldLock(): Promise<boolean> {
  if (!(await isLockEnabled())) return false;
  const raw = await AsyncStorage.getItem(BG_TIME_KEY);
  if (!raw) return false;
  return Date.now() - parseInt(raw) > LOCK_TIMEOUT;
}

export async function clearBackgroundTime(): Promise<void> {
  await AsyncStorage.removeItem(BG_TIME_KEY);
}
