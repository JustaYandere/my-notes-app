// Bumped by 0.01 with each pushed update so it's easy to confirm a deploy landed.
export const APP_VERSION = '0.54';

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
  { id: 1, title: 'Welcome to Makinote', body: "This is a note. Tap it to open, edit the title or body, and it saves automatically as you type.\n\nTap the paintbrush to give a note a color, tap the pin to keep it at the top, and swipe or use the menu to delete one you don't need. Long-press (or the ⋮ menu) opens more options like tags, reminders, and sharing.\n\nCheck out the other starter notes below — each one covers a different part of the app.", mode: 'note', checklist: [], pinned: false, hidden: false, tags: ['getting-started'], color: 'c2', createdAt: Date.now() - 1000 * 60 * 60 * 24 * 9, updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 9 },
  { id: 2, title: 'Groceries', body: '', mode: 'list', checklist: [{ id: 'i2', text: 'Milk', checked: false }, { id: 'i3', text: 'Eggs', checked: false }, { id: 'i4', text: 'Coffee', checked: true }], color: 'c3', pinned: false, hidden: false, tags: ['shopping'], createdAt: Date.now() - 1000 * 60 * 60 * 24, updatedAt: Date.now() - 1000 * 60 * 60 * 24 },
  { id: 3, title: 'Idea', body: 'Card game mechanic: color-matched combos.\n\nTip: a plain note like this can also hold a checklist at the same time — switch its mode to "both" from the note menu if you want text and checkable items together.', mode: 'note', checklist: [], pinned: false, hidden: false, tags: ['game-design'], createdAt: Date.now() - 1000 * 60 * 30, updatedAt: Date.now() - 1000 * 60 * 30 },
  { id: 4, title: 'Tags, search & colors', body: "Give notes tags (like \"work\" or \"shopping\") from the note menu, then filter by tag from the main screen to find things fast. The search bar looks through titles and bodies too.\n\nEach note can have its own color — tap the paintbrush icon while editing a note to pick one, or create your own custom colors in Settings → Colors. Sort your note list by recently edited, newest, color, or title from the sort menu.", mode: 'note', checklist: [], pinned: false, hidden: false, tags: ['getting-started', 'tips'], color: 'c4', createdAt: Date.now() - 1000 * 60 * 60 * 24 * 8, updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 8 },
  { id: 5, title: 'Reminders & voice notes', body: "Set a reminder on any note from the ⋮ menu (\"Set reminder\") and Makinote will notify you when it's due.\n\nYou can also record a voice memo right inside a note — look for the microphone control while editing — handy for quick thoughts you don't want to type out. Recordings are attached to the note and play back anytime.", mode: 'note', checklist: [], pinned: false, hidden: false, tags: ['getting-started', 'tips'], color: 'c1', createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7, updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 7 },
  { id: 6, title: 'Sync, sharing & privacy', body: "Sign in from Settings → Account to sync your notes across every device you use — everything stays local-only until you do.\n\nYou can also connect your account with someone else's and share individual notes with them from the note's Share menu; nothing is shared automatically. Need a copy of someone's shared note in your own list? Open it from \"Connected notes\" and use \"Copy to my notes.\"\n\nWant extra privacy? Turn on a PIN in Settings → Other to lock the app and hide sensitive notes from the main list.", mode: 'note', checklist: [], pinned: false, hidden: false, tags: ['getting-started', 'tips'], color: 'c3', createdAt: Date.now() - 1000 * 60 * 60 * 24 * 6, updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 6 },
  { id: 7, title: 'Make it yours', body: "Head to Settings to personalize things: switch between light/dark themes, pick a font, and adjust text size under Text.\n\nUnder Other, try a background effect for the main menu (rain or stars) or set an ambient sound to play while you write. You can also export any note as a .txt or Markdown file, or back up and restore all your notes at once.", mode: 'note', checklist: [], pinned: false, hidden: false, tags: ['getting-started', 'tips'], color: 'c2', createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5, updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5 },
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
export const MAX_CUSTOM = 20;
