import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * One JSON document under one AsyncStorage key, held in memory after the first read.
 *
 * Every local collection is a single blob: the whole transaction list, the whole budget list.
 * Before this, every read — each Home focus, each view-mode switch, each screen that wanted the
 * budget — went to native storage and `JSON.parse`d the entire list again, and the screens hid
 * that behind a skeleton. With the local store the source of truth, that round trip is the only
 * thing that stood between a tap and the data. Now the parsed value lives here: a read after the
 * first resolves in a microtask, and a write updates memory first, then writes through.
 *
 * `get` hands out a shallow copy so a caller can `push`/`sort` what it got back without editing
 * the store in place; the rows inside are shared, and the services already replace a row rather
 * than mutate it.
 */
export class JsonStore<T> {
  private readonly key:   string;
  private readonly empty: () => T;
  private value:   T | undefined;
  private loading: Promise<T> | null = null;

  constructor(key: string, empty: () => T) {
    this.key   = key;
    this.empty = empty;
    registry.push(this);
  }

  /** The parsed document (a shallow copy), read from storage on the first call only. */
  async get(): Promise<T> {
    if (this.value !== undefined) return copy(this.value);
    if (!this.loading) {
      const p = this.read().then(loaded => {
        // A set() or clear() that landed while the disk was being read wins over what it read.
        if (this.loading === p) { this.value = loaded; this.loading = null; }
        return loaded;
      });
      this.loading = p;
    }
    return copy(await this.loading);
  }

  /** Replace the document. Memory first, so a read that follows sees it before the disk does. */
  async set(next: T): Promise<void> {
    this.value   = next;
    this.loading = null;
    await AsyncStorage.setItem(this.key, JSON.stringify(next));
  }

  /** Forget the document in memory and on disk. */
  async clear(): Promise<void> {
    this.forget();
    await AsyncStorage.removeItem(this.key);
  }

  /** Drop only the in-memory copy; the next `get` re-reads storage. */
  forget(): void {
    this.value   = undefined;
    this.loading = null;
  }

  private async read(): Promise<T> {
    try {
      const raw = await AsyncStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : this.empty();
    } catch {
      return this.empty();
    }
  }
}

function copy<T>(v: T): T {
  if (Array.isArray(v)) return [...v] as T;
  if (v !== null && typeof v === 'object') return { ...v };
  return v;
}

const registry: JsonStore<any>[] = [];

/** Test support: the in-memory AsyncStorage is reset between cases, so these must be too. */
export function __resetLocalStores(): void {
  for (const s of registry) s.forget();
}
