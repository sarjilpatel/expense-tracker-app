import AsyncStorage from '@react-native-async-storage/async-storage';
// expo-file-system 19 moved the whole function API (documentDirectory, writeAsStringAsync,
// EncodingType, ...) behind /legacy; the main entry now exports only Paths/File/Directory.
import * as FileSystem from 'expo-file-system/legacy';

import { bumpDataVersion } from './dataVersion';
import apiClient from './apiClient';
import * as outbox from '@/src/sync/outbox';
import { noteLocalWrite } from '@/src/sync/scheduler';
import { isSignedIn } from '@/src/sync/session';
import { getLocalTransactionById } from './local/localTransactionService';

/**
 * Receipts are files on the device, one per transaction, in `documentDirectory/receipts/`.
 *
 * They join the backup through the outbox (W3-24): saving one queues an `attachments` upload
 * that the sync engine sends *after* the transaction row has landed; deleting one queues the
 * delete. The row then carries `receiptKey`, which is how another device — or this one after a
 * reinstall — knows there is a file to fetch. It is fetched **on demand** (`getReceipt`), never
 * on pull: a year of receipts is hundreds of megabytes and most are never looked at again.
 */
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
  bumpDataVersion();
}

export async function saveReceipt(txId: string, sourceUri: string): Promise<string> {
  await ensureDir();
  const ext = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const dest = `${RECEIPT_DIR}${txId}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  const map = await loadMap();
  map[txId] = dest;
  await saveMap(map);
  await outbox.enqueue({ collection: 'attachments', op: 'create', clientId: txId, groupId: null, payload: { uri: dest } });
  noteLocalWrite();
  return dest;
}

/**
 * The receipt's local file, fetching it from the server first if this device has never had it
 * (the row carries a `receiptKey` from another device or a previous install). Null when there
 * is none, or when it cannot be fetched right now.
 */
export async function getReceipt(txId: string): Promise<string | null> {
  const map = await loadMap();
  const uri = map[txId];
  if (uri) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) return uri;
  }
  if (!isSignedIn()) return null;
  const row = await getLocalTransactionById(txId);
  if (!row?.receiptKey) return null;
  try {
    const { data } = await apiClient.get(`/attachments/receipts/${encodeURIComponent(txId)}/url`);
    if (!data?.url) return null;
    await ensureDir();
    const ext = String(row.receiptKey).split('.').pop() || 'jpg';
    const dest = `${RECEIPT_DIR}${txId}.${ext}`;
    const result = await FileSystem.downloadAsync(data.url, dest);
    if (result.status !== 200) return null;
    map[txId] = dest;
    await saveMap(map);
    return dest;
  } catch {
    return null;
  }
}

/** Local files only — what Home reads for its indicator. A row's `receiptKey` covers the rest. */
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
  await outbox.enqueue({ collection: 'attachments', op: 'delete', clientId: txId, groupId: null, payload: {} });
  noteLocalWrite();
}

/** The sync engine's upload: multipart, against the transaction's clientId. */
export async function uploadReceipt(txId: string, uri: string): Promise<string | null> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return null;
  const ext = uri.split('.').pop() || 'jpg';
  const form = new FormData();
  form.append('file', { uri, name: `${txId}.${ext}`, type: ext === 'png' ? 'image/png' : 'image/jpeg' } as any);
  const { data } = await apiClient.post(`/attachments/receipts/${encodeURIComponent(txId)}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return data?.receiptKey ?? null;
}

export async function removeRemoteReceipt(txId: string): Promise<void> {
  await apiClient.delete(`/attachments/receipts/${encodeURIComponent(txId)}`);
}
