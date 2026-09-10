import type { Category } from '@/src/services/groupApi';

/**
 * Named packs of categories, so setting up for a wedding or a trip is one tap.
 *
 * This mirrors `utils/categoryPresets.js` on the backend, which stays the source of truth for a
 * signed-in user — the picker fetches the list from `/group/categories/presets` and the server
 * applies it. This copy exists for guest mode, which has no server to ask; it is the same
 * duplication the default category list already lives with (the `Group` model's defaults versus
 * `DEFAULT_CATEGORIES` in `localCategoryService`). Keep the keys in step with the backend: a key
 * the server does not know answers 404 when a signed-in user taps it.
 */
export interface CategoryPreset {
  key:         string;
  name:        string;
  description: string;
  icon:        string;
  count:       number;
  categories:  Omit<Category, '_id'>[];
}

export const CATEGORY_PRESETS: CategoryPreset[] = [
  {
    key: 'wedding', name: 'Wedding', icon: 'heart',
    description: 'Catering, venue, clothes and everything else a wedding runs up',
    categories: [
      { name: 'Catering (Jamvanu)',      icon: 'restaurant',    emoji: '🍽️', type: 'expense' },
      { name: 'Venue (Wadi/Hall)',       icon: 'business',      emoji: '🏛️', type: 'expense' },
      { name: 'Decoration',              icon: 'flower',        emoji: '💐', type: 'expense' },
      { name: 'Clothes',                 icon: 'shirt',         emoji: '👗', type: 'expense' },
      { name: 'Jewellery',               icon: 'diamond',       emoji: '💍', type: 'expense' },
      { name: 'Gifts (Kariyavar/Saadu)', icon: 'gift',          emoji: '🎁', type: 'expense' },
      { name: 'Music & Band',            icon: 'musical-notes', emoji: '🎶', type: 'expense' },
      { name: 'Photography/Video',       icon: 'camera',        emoji: '📸', type: 'expense' },
      { name: 'Invitations (Kankotri)',  icon: 'mail-open',     emoji: '💌', type: 'expense' },
      { name: 'Transportation',          icon: 'bus',           emoji: '🚌', type: 'expense' },
      { name: 'Mehendi/Parlour',         icon: 'color-palette', emoji: '💅', type: 'expense' },
      { name: 'Other Wedding Expenses',  icon: 'apps',          emoji: '📦', type: 'expense' },
    ],
  },
  {
    key: 'household', name: 'Household', icon: 'home',
    description: 'Running a home — bills, repairs, help and groceries',
    categories: [
      { name: 'Groceries',         icon: 'basket',    emoji: '🛒', type: 'expense' },
      { name: 'Electricity',       icon: 'flash',     emoji: '💡', type: 'expense' },
      { name: 'Water',             icon: 'water',     emoji: '🚿', type: 'expense' },
      { name: 'Gas Cylinder',      icon: 'flame',     emoji: '🔥', type: 'expense' },
      { name: 'Internet & Mobile', icon: 'wifi',      emoji: '📶', type: 'expense' },
      { name: 'Maintenance',       icon: 'construct', emoji: '🔧', type: 'expense' },
      { name: 'Househelp',         icon: 'people',    emoji: '🧹', type: 'expense' },
      { name: 'Repairs',           icon: 'hammer',    emoji: '🛠️', type: 'expense' },
    ],
  },
  {
    key: 'travel', name: 'Travel', icon: 'airplane',
    description: 'A trip, from tickets to souvenirs',
    categories: [
      { name: 'Flights',          icon: 'airplane',      emoji: '✈️', type: 'expense' },
      { name: 'Trains & Buses',   icon: 'train',         emoji: '🚆', type: 'expense' },
      { name: 'Stay',             icon: 'bed',           emoji: '🏨', type: 'expense' },
      { name: 'Local Transport',  icon: 'car-sport',     emoji: '🚕', type: 'expense' },
      { name: 'Eating Out',       icon: 'restaurant',    emoji: '🍜', type: 'expense' },
      { name: 'Sightseeing',      icon: 'camera',        emoji: '🗺️', type: 'expense' },
      { name: 'Souvenirs',        icon: 'bag-handle',    emoji: '🧳', type: 'expense' },
      { name: 'Visa & Insurance', icon: 'document-text', emoji: '📄', type: 'expense' },
    ],
  },
  {
    key: 'business', name: 'Business & Freelance', icon: 'briefcase',
    description: 'Client work — what comes in and what it costs to earn it',
    categories: [
      { name: 'Client Payment',     icon: 'cash',          emoji: '💰', type: 'income'  },
      { name: 'Retainer',           icon: 'repeat',        emoji: '🔁', type: 'income'  },
      { name: 'Software & Tools',   icon: 'laptop',        emoji: '💻', type: 'expense' },
      { name: 'Subcontractors',     icon: 'people',        emoji: '👥', type: 'expense' },
      { name: 'Office & Coworking', icon: 'business',      emoji: '🏢', type: 'expense' },
      { name: 'Marketing',          icon: 'megaphone',     emoji: '📣', type: 'expense' },
      { name: 'Professional Fees',  icon: 'document-text', emoji: '🧾', type: 'expense' },
      { name: 'Taxes',              icon: 'receipt',       emoji: '🏛️', type: 'expense' },
    ],
  },
  {
    key: 'vehicle', name: 'Vehicle', icon: 'car',
    description: 'Fuel, servicing and everything a car or bike asks for',
    categories: [
      { name: 'Fuel',            icon: 'speedometer', emoji: '⛽', type: 'expense' },
      { name: 'Servicing',       icon: 'construct',   emoji: '🔧', type: 'expense' },
      { name: 'Insurance',       icon: 'shield',      emoji: '🛡️', type: 'expense' },
      { name: 'Parking & Tolls', icon: 'pricetag',    emoji: '🅿️', type: 'expense' },
      { name: 'Fines',           icon: 'warning',     emoji: '🚨', type: 'expense' },
      { name: 'EMI',             icon: 'card',        emoji: '💳', type: 'expense' },
    ],
  },
  {
    key: 'baby', name: 'Baby & Kids', icon: 'happy',
    description: 'The first few years, and school after that',
    categories: [
      { name: 'Diapers & Wipes',   icon: 'cube',      emoji: '🧷', type: 'expense' },
      { name: 'Baby Food',         icon: 'nutrition', emoji: '🍼', type: 'expense' },
      { name: 'Clothes & Toys',    icon: 'balloon',   emoji: '🧸', type: 'expense' },
      { name: 'Doctor & Vaccines', icon: 'medical',   emoji: '💉', type: 'expense' },
      { name: 'Childcare',         icon: 'people',    emoji: '🧑‍🍼', type: 'expense' },
      { name: 'School Fees',       icon: 'school',    emoji: '🎒', type: 'expense' },
    ],
  },
  {
    key: 'student', name: 'Student', icon: 'school',
    description: 'Fees, books, rent and the rest of a term',
    categories: [
      { name: 'Tuition Fees',     icon: 'school',    emoji: '🎓', type: 'expense' },
      { name: 'Books & Supplies', icon: 'book',      emoji: '📚', type: 'expense' },
      { name: 'Hostel & Rent',    icon: 'home',      emoji: '🏠', type: 'expense' },
      { name: 'Mess & Canteen',   icon: 'fast-food', emoji: '🍱', type: 'expense' },
      { name: 'Coaching',         icon: 'easel',     emoji: '🧑‍🏫', type: 'expense' },
      { name: 'Scholarship',      icon: 'ribbon',    emoji: '🏅', type: 'income'  },
      { name: 'Part-time Work',   icon: 'briefcase', emoji: '💼', type: 'income'  },
    ],
  },
].map(p => ({ ...p, count: p.categories.length })) as CategoryPreset[];

export const findPreset = (key: string) => CATEGORY_PRESETS.find(p => p.key === key);
