import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category } from '../groupApi';

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
    return DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export async function getLocalCategories(): Promise<{ categories: Category[] }> {
  const categories = await load();
  return { categories };
}

export async function addLocalCategory(
  name: string, icon: string, type: 'income' | 'expense' | 'both', emoji?: string
): Promise<Category[]> {
  const cats = await load();
  const cat: Category = {
    _id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name, icon, type,
    ...(emoji ? { emoji } : {}),
  };
  cats.push(cat);
  await AsyncStorage.setItem(KEY, JSON.stringify(cats));
  return cats;
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
