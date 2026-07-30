import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && anonKey);

let keepSignedIn = true;
export function setKeepSignedIn(value) { keepSignedIn = value; }

// Routes Supabase's auth storage to localStorage (persists across app restarts)
// or sessionStorage (cleared when the tab/app closes), based on the
// "keep me signed in" choice made at login time.
const hybridStorage = {
  getItem: (key) => localStorage.getItem(key) ?? sessionStorage.getItem(key),
  setItem: (key, value) => {
    if (keepSignedIn) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase = supabaseEnabled ? createClient(url, anonKey, { auth: { storage: hybridStorage } }) : null;
