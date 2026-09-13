// expo-file-system/legacy outside a device: an in-memory file table.
const files = new Map();
export const documentDirectory = 'file:///doc/';
export const cacheDirectory = 'file:///cache/';
export const EncodingType = { UTF8: 'utf8', Base64: 'base64' };
export async function getInfoAsync(uri) { return { exists: files.has(uri) || uri.endsWith('/'), uri }; }
export async function makeDirectoryAsync() {}
export async function copyAsync({ from, to }) { files.set(to, files.get(from) ?? `copy of ${from}`); }
export async function deleteAsync(uri) { files.delete(uri); }
export async function writeAsStringAsync(uri, content) { files.set(uri, content); }
export async function readAsStringAsync(uri) { return files.get(uri) ?? ''; }
export async function downloadAsync(url, uri) { files.set(uri, `downloaded ${url}`); return { status: 200, uri }; }
export function __reset(seed = {}) { files.clear(); for (const [k, v] of Object.entries(seed)) files.set(k, v); }
export function __files() { return files; }
