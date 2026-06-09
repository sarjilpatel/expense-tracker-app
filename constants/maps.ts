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

// Muted, distinct per-category colours. Saturation ≈ 45–60 %, lightness ≈ 54–65 %
// so they read on both light and dark cards without looking neon.
export const CATEGORY_COLORS: Record<string, string> = {
  Food:          '#D97B6C',   // terracotta
  Transport:     '#6B9ED4',   // steel blue
  Transportation:'#6B9ED4',
  Shopping:      '#9B82C8',   // lavender
  Rent:          '#6BA88C',   // sage green
  Entertainment: '#D4924E',   // amber
  Health:        '#C97A88',   // dusty rose
  Bills:         '#7BA3C4',   // sky blue
  Education:     '#8FA85E',   // olive
  Investment:    '#4AACB8',   // teal
  Income:        '#6AAE78',   // leaf green
  Salary:        '#79A86A',   // medium green
  Other:         '#A0A0A0',   // neutral gray
  Beauty:        '#D485A0',   // dusty pink
  Recharge:      '#56B0C8',   // muted cyan
  Apparel:       '#B880AC',   // muted plum
  Household:     '#C8A84B',   // golden mustard
  Business:      '#8A7EC8',   // muted indigo
  Gift:          '#D49070',   // muted peach
  Culture:       '#7AAEC8',   // muted cerulean
  Travel:        '#5AACAB',   // seafoam
  Groceries:     '#8BBF66',   // muted lime
  Subscriptions: '#AB85C0',   // muted purple
  Pets:          '#C8956A',   // caramel
  Sports:        '#5AAC8A',   // muted emerald
  Dining:        '#C87060',   // burnt sienna
};

// Cycling fallback for user-defined categories not in the map above
export const CATEGORY_PALETTE: string[] = [
  '#D97B6C', '#6B9ED4', '#9B82C8', '#6BA88C',
  '#D4924E', '#C97A88', '#4AACB8', '#C8A84B',
  '#8A7EC8', '#5AACAB', '#D485A0', '#8FA85E',
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
