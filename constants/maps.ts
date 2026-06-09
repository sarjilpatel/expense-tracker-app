export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CAL_DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const CHART_COLORS = [
  '#18181B', '#27272A', '#3F3F46', '#52525B', '#71717A',
  '#A1A1AA', '#D4D4D8', '#E5E7EB', '#F3F4F6', '#F4F4F5',
];

export const CATEGORY_ICONS: Record<string, string> = {
  Food: 'fast-food-outline',
  Transport: 'bus-outline',
  Shopping: 'cart-outline',
  Rent: 'home-outline',
  Entertainment: 'game-controller-outline',
  Health: 'heart-outline',
  Bills: 'receipt-outline',
  Education: 'book-outline',
  Investment: 'trending-up-outline',
  Income: 'cash-outline',
  Salary: 'wallet-outline',
  Other: 'ellipsis-horizontal-outline',
  Beauty: 'sparkles-outline',
  Recharge: 'phone-portrait-outline',
  Apparel: 'shirt-outline',
  Household: 'home-outline',
};

// Per-category colours — expense categories use warm tones, income categories use cool/green tones.
// Saturation ≈ 45–58 %, lightness ≈ 50–62 % — readable on both light & dark, never neon.
export const CATEGORY_COLORS: Record<string, string> = {
  // ── Expense categories (warm spectrum: red → orange → amber → olive) ──
  Food:          '#BF5048',   // muted crimson-red
  Dining:        '#C4603C',   // muted red-orange
  Shopping:      '#C47038',   // muted burnt orange
  Entertainment: '#C48838',   // muted amber-orange
  Household:     '#C4A040',   // muted golden amber
  Rent:          '#B09848',   // muted yellow-ochre
  Bills:         '#A49450',   // muted olive-amber
  Recharge:      '#9A9050',   // muted olive-yellow
  Beauty:        '#C05870',   // muted rose (warm pink sits near red end)
  Apparel:       '#B06090',   // muted plum-rose
  Pets:          '#C47848',   // muted caramel-orange
  Health:        '#C06070',   // muted dusty rose
  Subscriptions: '#9878B0',   // muted purple (warm tail)
  // ── Income / savings categories (cool/fresh spectrum: green → teal → blue) ──
  Income:        '#52A870',   // muted leaf green
  Salary:        '#60A878',   // medium green
  Investment:    '#44A4B0',   // muted teal
  Travel:        '#50A8A0',   // seafoam
  Groceries:     '#7AB060',   // muted lime green
  Education:     '#8AA45C',   // muted olive green
  Transport:     '#5E98C8',   // muted cornflower blue
  Transportation:'#5E98C8',
  Culture:       '#6898B8',   // muted cerulean
  Sports:        '#58A888',   // muted emerald
  Business:      '#7878BC',   // muted indigo
  Gift:          '#C49068',   // muted peach (warm — gifts are spending)
  // ── Neutral ──
  Other:         '#9898A0',   // cool gray
};

// Generic cycling fallback (kept for backwards compat)
export const CATEGORY_PALETTE: string[] = [
  '#D97B6C', '#6B9ED4', '#9B82C8', '#6BA88C',
  '#D4924E', '#C97A88', '#4AACB8', '#C8A84B',
  '#8A7EC8', '#5AACAB', '#D485A0', '#8FA85E',
];

// Warm spectrum for expense charts: red → orange → amber → olive → neutral
export const EXPENSE_PALETTE: string[] = [
  '#BF5048', // muted crimson
  '#C4633C', // muted red-orange
  '#C47438', // muted burnt orange
  '#C48B3A', // muted amber
  '#C4A040', // muted golden amber
  '#B09848', // muted yellow-ochre
  '#9A9450', // muted olive-yellow
  '#8AA45C', // muted olive green
  '#9E82B8', // muted lavender (tail)
  '#7898BC', // muted steel blue (tail)
  '#A09898', // warm gray
];

// Cool/fresh spectrum for income charts: green → teal → blue → indigo → neutral
export const INCOME_PALETTE: string[] = [
  '#52A870', // muted leaf green
  '#44A4B0', // muted teal
  '#50A8A0', // seafoam
  '#4EAABF', // muted cyan
  '#5E98C8', // muted cornflower blue
  '#6A9CB8', // sky blue
  '#7E7EBC', // muted indigo
  '#9880B8', // muted lavender
  '#7AB060', // muted lime green
  '#60A080', // sage teal
  '#9898A0', // cool gray
];

export const CATEGORY_EMOJIS: Record<string, string> = {
  Food: '🍜',
  Transport: '🚌',
  Transportation: '🚌',
  Shopping: '🛍️',
  Rent: '🏠',
  Entertainment: '🎬',
  Health: '🏥',
  Bills: '🧾',
  Education: '📚',
  Investment: '📈',
  Income: '💰',
  Salary: '💼',
  Other: '🏷️',
  Beauty: '💄',
  Recharge: '🔌',
  Apparel: '👗',
  Household: '🪑',
  Business: '🏢',
  Gift: '🎁',
  Culture: '🎭',
  Travel: '✈️',
  Groceries: '🛒',
  Subscriptions: '📱',
  Pets: '🐾',
  Sports: '⚽',
  Dining: '🍽️',
};
