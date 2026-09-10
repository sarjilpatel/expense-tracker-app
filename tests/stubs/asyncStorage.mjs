// In-memory AsyncStorage. The local services under test are exercised for real against it, so
// what is being tested is their actual read/write/retain behaviour rather than a description of it.

let store = new Map();

const AsyncStorage = {
  async getItem(key)        { return store.has(key) ? store.get(key) : null; },
  async setItem(key, value) { store.set(key, String(value)); },
  async removeItem(key)     { store.delete(key); },
  async multiRemove(keys)   { for (const k of keys) store.delete(k); },
  async getAllKeys()        { return [...store.keys()]; },
  async clear()             { store.clear(); },
};

/** Test control: wipe everything between cases. */
export function __reset(seed = {}) {
  store = new Map(Object.entries(seed).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
}

/** Test control: read what the code actually persisted. */
export function __raw(key) { return store.has(key) ? store.get(key) : null; }
export function __keys()   { return [...store.keys()]; }

export default AsyncStorage;
