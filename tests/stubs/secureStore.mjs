// expo-secure-store is native-only. Tokens live here in tests.
let store = new Map();

export async function getItemAsync(key)        { return store.has(key) ? store.get(key) : null; }
export async function setItemAsync(key, value) { store.set(key, String(value)); }
export async function deleteItemAsync(key)     { store.delete(key); }

export function __reset(seed = {}) { store = new Map(Object.entries(seed)); }
