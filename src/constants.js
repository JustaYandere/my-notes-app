export const FONT_OPTIONS = {
  classic: { label: 'Classic', title: "'Fraunces', serif", body: "'Inter', sans-serif" },
  sans: { label: 'Clean Sans', title: "'Inter', sans-serif", body: "'Inter', sans-serif" },
  serif: { label: 'Serif', title: "'Georgia', serif", body: "'Georgia', serif" },
  mono: { label: 'Mono', title: "'JetBrains Mono', monospace", body: "'JetBrains Mono', monospace" },
};

export const STARTER_COLORS = [
  { id: 'c1', hex: '#E8735F', label: 'Color 1' },
  { id: 'c2', hex: '#5B9BB8', label: 'Color 2' },
  { id: 'c3', hex: '#7FA671', label: 'Color 3' },
  { id: 'c4', hex: '#E3B23C', label: 'Color 4' },
];

export const STARTER_THEMES = [
  { id: 'black', label: 'Black', hex: '#0A0A0A', cardLighter: true },
  { id: 'white', label: 'White', hex: '#FAFAFA', cardLighter: false },
];

export const SEED_NOTES = [
  { id: 1, title: 'Welcome', body: 'Tap a note to open it. Select text and click the strike icon to ~~cross it out~~.', mode: 'note', checklist: [{ id: 'i1', text: 'Try checking this off', checked: false }], pinned: false, hidden: false, tags: ['getting-started'], color: 'c2', createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3, updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3 },
  { id: 2, title: 'Groceries', body: '', mode: 'list', checklist: [{ id: 'i2', text: 'Milk', checked: false }, { id: 'i3', text: 'Eggs', checked: false }, { id: 'i4', text: 'Coffee', checked: true }], color: 'c3', pinned: false, hidden: false, tags: ['shopping'], createdAt: Date.now() - 1000 * 60 * 60 * 24, updatedAt: Date.now() - 1000 * 60 * 60 * 24 },
  { id: 3, title: 'Idea', body: 'Card game mechanic: color-matched combos', mode: 'note', checklist: [], color: 'c1', pinned: false, hidden: false, tags: ['game-design'], createdAt: Date.now() - 1000 * 60 * 30, updatedAt: Date.now() - 1000 * 60 * 30 },
];

export const SORT_OPTIONS = [
  { value: 'updated-desc', label: 'Recently edited' },
  { value: 'created-desc', label: 'Newest first' },
  { value: 'created-asc', label: 'Oldest first' },
  { value: 'color', label: 'Color' },
  { value: 'title', label: 'Title (A–Z)' },
];

export const SIZE_STEPS = ['compact', 'comfortable', 'large', 'xl'];
export const SCALE_MAP = { compact: 0.85, comfortable: 1, large: 1.2, xl: 1.4 };

export const NOTES_KEY = 'makinote_notes_v1';
export const SETTINGS_KEY = 'makinote_settings_v1';
export const LEGACY_NOTES_KEY = 'colornote_clone_notes_v7';
export const LEGACY_SETTINGS_KEY = 'colornote_clone_settings_v7';
export const MAX_HISTORY = 50;
export const MAX_CUSTOM = 10;
