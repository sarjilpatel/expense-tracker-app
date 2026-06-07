import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const RECEIPT_MAP_KEY = '@receipt_map';
const RECEIPT_DIR = `${FileSystem.documentDirectory}receipts/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(RECEIPT_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(RECEIPT_DIR, { intermediates: true });
}

async function loadMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(RECEIPT_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveMap(map: Record<string, string>) {
  await AsyncStorage.setItem(RECEIPT_MAP_KEY, JSON.stringify(map));
}

export async function saveReceipt(txId: string, sourceUri: string): Promise<string> {
  await ensureDir();
  const ext = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const dest = `${RECEIPT_DIR}${txId}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  const map = await loadMap();
  map[txId] = dest;
  await saveMap(map);
  return dest;
}

export async function getReceipt(txId: string): Promise<string | null> {
  const map = await loadMap();
  const uri = map[txId];
  if (!uri) return null;
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? uri : null;
}

export async function getReceiptMap(): Promise<Record<string, string>> {
  return loadMap();
}

export async function deleteReceipt(txId: string): Promise<void> {
  const map = await loadMap();
  const uri = map[txId];
  if (uri) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    delete map[txId];
    await saveMap(map);
  }
}
