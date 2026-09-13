import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSyncMeta } from '@/src/sync/meta';
import type { Category } from '../groupApi';
import { CATEGORY_PRESETS, findPreset } from '@/constants/categoryPresets';

const KEY = '@local_categories_v1';

const DEFAULT_CATEGORIES: Category[] = [
  { _id: 'dc_1',  name: 'Food',          icon: 'fast-food-outline',           emoji: '🍔', type: 'expense' },
  { _id: 'dc_2',  name: 'Transport',     icon: 'car-outline',                 emoji: '🚗', type: 'expense' },
  { _id: 'dc_3',  name: 'Shopping',      icon: 'cart-outline',                emoji: '🛒', type: 'expense' },
  { _id: 'dc_4',  name: 'Rent',          icon: 'home-outline',                emoji: '🏠', type: 'expense' },
  { _id: 'dc_5',  name: 'Entertainment', icon: 'game-controller-outline',     emoji: '🎮', type: 'expense' },
  { _id: 'dc_6',  name: 'Health',        icon: 'medical-outline',             emoji: '💊', type: 'expense' },
  { _id: 'dc_7',  name: 'Utilities',     icon: 'flash-outline',               emoji: '💡', type: 'expense' },
  { _id: 'dc_8',  name: 'Education',     icon: 'school-outline',              emoji: '📚', type: 'expense' },
  { _id: 'dc_9',  name: 'Other',         icon: 'ellipsis-horizontal-outline', emoji: '📦', type: 'both'    },
  { _id: 'dc_10', name: 'Salary',        icon: 'briefcase-outline',           emoji: '💼', type: 'income'  },
  { _id: 'dc_11', name: 'Freelance',     icon: 'laptop-outline',              emoji: '💻', type: 'income'  },
  { _id: 'dc_12', name: 'Investment',    icon: 'trending-up-outline',         emoji: '📈', type: 'income'  },
  { _id: 'dc_13', name: 'Gift',          icon: 'gift-outline',                emoji: '🎁', type: 'income'  },
];

async function load(): Promise<Category[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const cats: Category[] = JSON.parse(raw);
      let migrated = false;
      const updated = cats.map(cat => {
        if (!cat.emoji) {
          const def = DEFAULT_CATEGORIES.find(d => d._id === cat._id);
          if (def?.emoji) { migrated = true; return { ...cat, emoji: def.emoji }; }
        }
        return cat;
      });
      if (migrated) await AsyncStorage.setItem(KEY, JSON.stringify(updated));
      return updated;
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(DEFAULT_CATEGORIES));
    return [...DEFAULT_CATEGORIES];
  } catch {
    return [...DEFAULT_CATEGORIES];
  }
}
// Both returns copy. Callers push onto what load() hands back, so returning the array itself let
// an added category mutate DEFAULT_CATEGORIES for the life of the process — after which clearing
// local data reseeded the "defaults" with someone's custom categories still in them.

/** The active group's categories when signed in (plus any not yet pushed); everything as a guest. */
async function inScope(cats: Category[]): Promise<Category[]> {
  const { activeGroupId } = await getSyncMeta();
  if (!activeGroupId) return cats;
  return cats.filter(c => !(c as any).groupId || String((c as any).groupId) === activeGroupId);
}

export async function getLocalCategories(): Promise<{ categories: Category[] }> {
  const categories = await inScope(await load());
  return { categories };
}

/** The bundled catalogue — a guest has no server to ask for it. */
export async function getLocalPresets() {
  return CATEGORY_PRESETS.map(({ key, name, description, icon, count }) =>
    ({ key, name, description, icon, count }));
}

export async function addLocalCategory(
  name: string, icon: string, type: 'income' | 'expense' | 'both', emoji?: string
): Promise<Category[]> {
  const cats = await load();

  // The server refuses a duplicate name — transactions reference categories by name, so two of
  // them make the group's category check ambiguous. The guest side has to agree, or the same tap
  // succeeds before signing in and fails after.
  if (cats.some(c => c.name.trim().toLowerCase() === name.trim().toLowerCase())) {
    throw new Error('That category already exists');
  }

  const cat: Category = {
    _id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name, icon, type,
    ...(emoji ? { emoji } : {}),
  };
  cats.push(cat);
  await AsyncStorage.setItem(KEY, JSON.stringify(cats));
  return cats;
}

/**
 * Adds a named pack in one go. Matched on name case-insensitively, so applying the same preset
 * twice — or two packs that overlap — adds nothing already present, exactly as the server does.
 */
export async function applyLocalPreset(key: string): Promise<{ categories: Category[]; added: number }> {
  const preset = findPreset(key);
  if (!preset) throw new Error('Unknown category preset');

  const cats  = await load();
  const have  = new Set(cats.map(c => c.name.trim().toLowerCase()));
  const added = preset.categories
    .filter(c => !have.has(c.name.toLowerCase()))
    .map(c => ({ ...c, _id: Date.now().toString(36) + Math.random().toString(36).slice(2) }));

  if (added.length) {
    cats.push(...added);
    await AsyncStorage.setItem(KEY, JSON.stringify(cats));
  }
  return { categories: cats, added: added.length };
}

export async function removeLocalCategory(id: string): Promise<Category[]> {
  const cats = await load();
  const filtered = cats.filter(c => c._id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(filtered));
  return filtered;
}

export async function getAllLocalCategories(): Promise<Category[]> {
  return load();
}

export async function clearLocalCategories(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

/**
 * Keeps the built-in defaults plus the given custom ids — used by sync to hold on to
 * whatever failed to upload. Clearing the key outright would restore defaults on next
 * load and silently drop the custom categories that never made it to the server.
 */
export async function retainLocalCategories(ids: string[]): Promise<void> {
  const keep = new Set(ids);
  if (keep.size === 0) return clearLocalCategories();
  const all = await load();
  const kept = all.filter(c => c._id.startsWith('dc_') || keep.has(c._id));
  await AsyncStorage.setItem(KEY, JSON.stringify(kept));
}

// ── Sync support (W3) ─────────────────────────────────────────────────────────
// Rows arrive from other devices and other group members through the changes feed; the engine
// upserts them here by clientId (which *is* the local id) and removes tombstones. Reads filter on
// the active group when signed in: a row with no groupId is this device's own, not yet pushed.

export async function upsertLocalCategory(row: Category & { groupId?: string | null }): Promise<void> {
  const all = await load();
  const idx = all.findIndex(c => c._id === row._id);
  if (idx === -1) all.push(row); else all[idx] = { ...all[idx], ...row };
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

export async function dropLocalCategory(id: string): Promise<void> {
  const all = await load();
  const next = all.filter(c => c._id !== id);
  if (next.length !== all.length) await AsyncStorage.setItem(KEY, JSON.stringify(next));
}
