import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search, Plus, Trash2, LayoutGrid, Rows3, Minus, PlusIcon,
  Settings, Download, Upload, X, Lock, Strikethrough,
  GitCompare, RotateCcw, Archive, Check, Undo2, Redo2, Save, ArrowLeft,
  MoreVertical, Pin, EyeOff, Eye, FileText, Share2, Palette, Type, SlidersHorizontal, ChevronRight,
} from 'lucide-react';

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
function rgbToHex(r, g, b) { return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join(''); }
function mixColors(hexA, hexB, ratio) {
  const a = [parseInt(hexA.slice(1, 3), 16), parseInt(hexA.slice(3, 5), 16), parseInt(hexA.slice(5, 7), 16)];
  const b = [parseInt(hexB.slice(1, 3), 16), parseInt(hexB.slice(3, 5), 16), parseInt(hexB.slice(5, 7), 16)];
  const mixed = a.map((v, i) => Math.round(v * ratio + b[i] * (1 - ratio)));
  return rgbToHex(mixed[0], mixed[1], mixed[2]);
}
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function shadeHex(hex, hueOverride, satCap, lightness) {
  const [h, s] = hexToHsl(hex);
  const [r, g, b] = hslToRgb(hueOverride != null ? hueOverride : h, Math.min(s, satCap), clamp01(lightness));
  return rgbToHex(r, g, b);
}
function computeThemeFromColor(hex, cardLighter) {
  const [h, s, l] = hexToHsl(hex);
  const bg = hex;
  const elevated = shadeHex(hex, h, 1, l + (cardLighter ? 0.07 : -0.07));
  const isDarkBg = l < 0.5;
  const text = shadeHex(hex, h, 0.2, isDarkBg ? 0.94 : 0.14);
  const muted = shadeHex(hex, h, 0.25, isDarkBg ? 0.62 : 0.46);
  const border = shadeHex(hex, h, 0.2, clamp01(l + (isDarkBg ? 0.09 : -0.09)));
  return { bg, elevated, text, muted, border, isDark: isDarkBg };
}

function ColorWheel({ size = 160, hue, sat, onChange }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const r = size / 2;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - r + 0.5, dy = y - r + 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * size + x) * 4;
        if (dist <= r) {
          let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          if (angle < 0) angle += 360;
          const saturation = Math.min(dist / r, 1);
          const [rr, gg, bb] = hslToRgb(angle, saturation, 0.5);
          img.data[idx] = rr; img.data[idx + 1] = gg; img.data[idx + 2] = bb; img.data[idx + 3] = 255;
        } else { img.data[idx + 3] = 0; }
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [size]);

  function pick(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left, y = clientY - rect.top;
    const r = size / 2;
    const dx = x - r, dy = y - r;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), r);
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    onChange(angle, dist / r);
  }

  const rad = (hue * Math.PI) / 180;
  const handleR = sat * (size / 2);
  const hx = size / 2 + handleR * Math.cos(rad);
  const hy = size / 2 + handleR * Math.sin(rad);

  return (
    <div
      style={{ position: 'relative', width: size, height: size, touchAction: 'none', cursor: 'crosshair' }}
      onMouseDown={(e) => {
        pick(e);
        const move = (ev) => pick(ev);
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      }}
      onTouchStart={pick}
      onTouchMove={pick}
    >
      <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: '50%', display: 'block' }} />
      <div style={{ position: 'absolute', left: hx - 7, top: hy - 7, width: 14, height: 14, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.45)', pointerEvents: 'none' }} />
    </div>
  );
}

function LightnessSlider({ hue, sat, value, onChange, height = 26 }) {
  const trackRef = useRef(null);
  const fullColor = rgbToHex(...hslToRgb(hue, sat, 0.5));
  const thumbColor = rgbToHex(...hslToRgb(hue, sat, value));
  function pick(e) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    onChange(rect.width === 0 ? 0 : x / rect.width);
  }
  return (
    <div
      ref={trackRef}
      style={{ position: 'relative', width: '100%', height, borderRadius: height / 2, background: `linear-gradient(to right, #000, ${fullColor}, #fff)`, cursor: 'pointer', touchAction: 'none' }}
      onMouseDown={(e) => {
        pick(e);
        const move = (ev) => pick(ev);
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      }}
      onTouchStart={pick}
      onTouchMove={pick}
    >
      <div style={{ position: 'absolute', left: `calc(${value * 100}% - ${height / 2}px)`, top: '50%', transform: 'translateY(-50%)', width: height, height, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.45)', background: thumbColor, pointerEvents: 'none' }} />
    </div>
  );
}

const FONT_OPTIONS = {
  classic: { label: 'Classic', title: "'Fraunces', serif", body: "'Inter', sans-serif" },
  sans: { label: 'Clean Sans', title: "'Inter', sans-serif", body: "'Inter', sans-serif" },
  serif: { label: 'Serif', title: "'Georgia', serif", body: "'Georgia', serif" },
  mono: { label: 'Mono', title: "'JetBrains Mono', monospace", body: "'JetBrains Mono', monospace" },
};

const STARTER_COLORS = [
  { id: 'c1', hex: '#E8735F', label: 'Color 1' },
  { id: 'c2', hex: '#5B9BB8', label: 'Color 2' },
  { id: 'c3', hex: '#7FA671', label: 'Color 3' },
  { id: 'c4', hex: '#E3B23C', label: 'Color 4' },
];

const STARTER_THEMES = [
  { id: 'black', label: 'Black', hex: '#0A0A0A', cardLighter: true },
  { id: 'white', label: 'White', hex: '#FAFAFA', cardLighter: false },
];

const SEED_NOTES = [
  { id: 1, title: 'Welcome', body: 'Tap a note to open it. Select text and click the strike icon to ~~cross it out~~.', mode: 'note', checklist: [{ id: 'i1', text: 'Try checking this off', checked: false }], pinned: false, hidden: false, tags: ['getting-started'], color: 'c2', createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3, updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3 },
  { id: 2, title: 'Groceries', body: '', mode: 'list', checklist: [{ id: 'i2', text: 'Milk', checked: false }, { id: 'i3', text: 'Eggs', checked: false }, { id: 'i4', text: 'Coffee', checked: true }], color: 'c3', pinned: false, hidden: false, tags: ['shopping'], createdAt: Date.now() - 1000 * 60 * 60 * 24, updatedAt: Date.now() - 1000 * 60 * 60 * 24 },
  { id: 3, title: 'Idea', body: 'Card game mechanic: color-matched combos', mode: 'note', checklist: [], color: 'c1', pinned: false, hidden: false, tags: ['game-design'], createdAt: Date.now() - 1000 * 60 * 30, updatedAt: Date.now() - 1000 * 60 * 30 },
];

const SORT_OPTIONS = [
  { value: 'updated-desc', label: 'Recently edited' },
  { value: 'created-desc', label: 'Newest first' },
  { value: 'created-asc', label: 'Oldest first' },
  { value: 'color', label: 'Color' },
  { value: 'title', label: 'Title (A–Z)' },
];

const SIZE_STEPS = ['compact', 'comfortable', 'large', 'xl'];
const SCALE_MAP = { compact: 0.85, comfortable: 1, large: 1.2, xl: 1.4 };

const NOTES_KEY = 'colornote_clone_notes_v7';
const SETTINGS_KEY = 'colornote_clone_settings_v7';
const MAX_HISTORY = 50;
const MAX_CUSTOM = 10;

function loadLocal(key) { try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function saveLocal(key, value) { try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
function previewText(body) { return (body || '').replace(/~~(.*?)~~/g, '$1').replace(/\n/g, ' ').trim(); }
function renderStrike(text, keyPrefix) {
  const parts = text.split(/(~~.*?~~)/g);
  return parts.map((p, i) => (p.startsWith('~~') && p.endsWith('~~') ? <s key={`${keyPrefix}-${i}`}>{p.slice(2, -2)}</s> : <span key={`${keyPrefix}-${i}`}>{p}</span>));
}
function renderBody(body, keyPrefix) {
  const lines = (body || '').split('\n');
  return lines.map((line, i) => (line.trim() ? <div key={i}>{renderStrike(line, `${keyPrefix}-${i}`)}</div> : <div key={i} style={{ height: '0.6em' }} />));
}
function wordsOf(note) {
  return new Set(((note.title || '') + ' ' + (note.body || '') + ' ' + (note.checklist || []).map((i) => i.text).join(' ')).toLowerCase().match(/[a-z0-9']+/g) || []);
}
function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
function sortChecklistItems(items) {
  return items.map((it, i) => ({ it, i })).sort((a, b) => (a.it.checked === b.it.checked ? a.i - b.i : a.it.checked ? 1 : -1)).map((x) => x.it);
}
function isFullyStruck(line) {
  return /~~.+?~~/.test(line);
}
function reorderBodyByStrike(body) {
  const lines = body.split('\n');
  return lines.map((l, i) => ({ l, i })).sort((a, b) => {
    const as = isFullyStruck(a.l), bs = isFullyStruck(b.l);
    return as === bs ? a.i - b.i : as ? 1 : -1;
  }).map((x) => x.l).join('\n');
}

function wordCount(str) { return (str || '').trim().split(/\s+/).filter(Boolean).length; }
function previewPlan(note) {
  const mode = note.mode || 'note';
  if (mode !== 'both') return { showBody: mode === 'note', showChecklist: mode === 'list' };
  const bodyWords = wordCount(previewText(note.body));
  const checklistWords = (note.checklist || []).reduce((sum, it) => sum + wordCount(it.text), 0);
  if (bodyWords === 0 && checklistWords === 0) return { showBody: true, showChecklist: false };
  const bigger = Math.max(bodyWords, checklistWords);
  const smaller = Math.min(bodyWords, checklistWords);
  const relativelySimilar = bigger > 0 && smaller / bigger >= 0.6;
  if ((bodyWords > 10 && checklistWords > 10) || relativelySimilar) return { showBody: true, showChecklist: true };
  return checklistWords > bodyWords ? { showBody: false, showChecklist: true } : { showBody: true, showChecklist: false };
}

function relativeLuminance(hex) {
  const chan = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const r = chan(parseInt(hex.slice(1, 3), 16));
  const g = chan(parseInt(hex.slice(3, 5), 16));
  const b = chan(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastText(hex) {
  const lum = relativeLuminance(hex);
  const contrastWithWhite = (1 + 0.05) / (lum + 0.05);
  const contrastWithBlack = (lum + 0.05) / (0 + 0.05);
  return contrastWithBlack > contrastWithWhite ? '#141414' : '#FAFAFA';
}

function Checkbox({ checked, onToggle, accent, mutedColor }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={checked ? 'Mark as not done' : 'Mark as done'}
      style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${checked ? accent : mutedColor}`, background: checked ? accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0, marginTop: 1 }}
    >
      {checked && <Check size={12} color="#fff" strokeWidth={3} />}
    </button>
  );
}

export default function NotesApp() {
  const [hydrated, setHydrated] = useState(false);
  const [customColors, setCustomColors] = useState(STARTER_COLORS);
  const [activeThemeId, setActiveThemeId] = useState('black');
  const [customThemes, setCustomThemes] = useState(STARTER_THEMES);
  const [themeWheelHue, setThemeWheelHue] = useState(220);
  const [themeWheelSat, setThemeWheelSat] = useState(0.4);
  const [themeWheelLight, setThemeWheelLight] = useState(0.15);
  const [themeCardLighter, setThemeCardLighter] = useState(true);
  const [modalTint, setModalTint] = useState(100);
  const [separatorColorId, setSeparatorColorId] = useState('none');
  const [titleFocused, setTitleFocused] = useState(false);

  const [notes, setNotes] = useState(SEED_NOTES);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('updated-desc');
  const [editingId, setEditingId] = useState(null);
  const [view, setView] = useState('grid');
  const [noteSizeIdx, setNoteSizeIdx] = useState(1);
  const [textSizeIdx, setTextSizeIdx] = useState(1);
  const [defaultColor, setDefaultColor] = useState('random');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [autoMoveCompleted, setAutoMoveCompleted] = useState(false);
  const [fontChoice, setFontChoice] = useState('classic');
  const [confirmOnClose, setConfirmOnClose] = useState(true);
  const [fullScreenEditor, setFullScreenEditor] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [hiddenPinCheck, setHiddenPinCheck] = useState(false);
  const [hiddenPinEntry, setHiddenPinEntry] = useState('');
  const [hiddenPinError, setHiddenPinError] = useState('');
  const [pendingClose, setPendingClose] = useState(false);
  const [preEditSnapshot, setPreEditSnapshot] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [similarThreshold, setSimilarThreshold] = useState(0.2);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [similarOpen, setSimilarOpen] = useState(false);
  const [noteMenuOpen, setNoteMenuOpen] = useState(false);
  const [menuColorExpanded, setMenuColorExpanded] = useState(false);
  const [menuShareInfo, setMenuShareInfo] = useState(false);
  const [selectedTagFilters, setSelectedTagFilters] = useState([]);

  const [pinEnabled, setPinEnabled] = useState(false);
  const [pin, setPin] = useState('');
  const [locked, setLocked] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSetupError, setPinSetupError] = useState('');

  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [lastSaved, setLastSaved] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const [wheelHue, setWheelHue] = useState(200);
  const [wheelSat, setWheelSat] = useState(0.6);
  const [wheelLight, setWheelLight] = useState(0.55);

  const nextId = useRef(4);
  const nextItemId = useRef(10);
  const nextColorId = useRef(5);
  const nextThemeId = useRef(2);
  const fileInputRef = useRef(null);
  const textareaRefs = useRef({});
  const titleRefs = useRef({});
  const addItemRefs = useRef({});
  const tagInputRefs = useRef({});
  const scale = SCALE_MAP[SIZE_STEPS[noteSizeIdx]];
  const textScale = SCALE_MAP[SIZE_STEPS[textSizeIdx]];
  const s = (n) => Math.round(n * scale);
  const fz = (n) => Math.round(n * textScale);

  const activePreset = customThemes.find((t) => t.id === activeThemeId) || customThemes[0];
  const theme = computeThemeFromColor(activePreset.hex, activePreset.cardLighter);

  function colorHexOf(colorId) { return customColors.find((c) => c.id === colorId)?.hex || customColors[0]?.hex || '#5B9BB8'; }
  function colorLabelOf(colorId) { return customColors.find((c) => c.id === colorId)?.label || 'Color'; }

  useEffect(() => {
    const savedNotes = loadLocal(NOTES_KEY);
    let initialNotes = SEED_NOTES;
    if (Array.isArray(savedNotes) && savedNotes.length) {
      initialNotes = savedNotes.map((n) => ({ checklist: [], pinned: false, hidden: false, tags: [], mode: 'note', ...n }));
      setNotes(initialNotes);
      nextId.current = Math.max(4, ...initialNotes.map((n) => (n.id || 0) + 1));
      const existingItemNums = initialNotes.flatMap((n) => (n.checklist || []).map((it) => parseInt(String(it.id).replace(/\D/g, ''), 10) || 0));
      nextItemId.current = Math.max(10, ...existingItemNums, 0) + 1;
      const seenItemIds = new Set();
      let hadDuplicates = false;
      initialNotes = initialNotes.map((n) => {
        if (!n.checklist || n.checklist.length === 0) return n;
        const fixedChecklist = n.checklist.map((it) => {
          if (seenItemIds.has(it.id)) {
            hadDuplicates = true;
            return { ...it, id: `i${nextItemId.current++}` };
          }
          seenItemIds.add(it.id);
          return it;
        });
        return { ...n, checklist: fixedChecklist };
      });
      if (hadDuplicates) setNotes(initialNotes);
    }
    setLastSaved(JSON.stringify(initialNotes));
    const savedSettings = loadLocal(SETTINGS_KEY);
    if (savedSettings) {
      if (Array.isArray(savedSettings.customColors) && savedSettings.customColors.length) { setCustomColors(savedSettings.customColors); nextColorId.current = savedSettings.customColors.length + 1; }
      if (savedSettings.activeThemeId) setActiveThemeId(savedSettings.activeThemeId);
      if (Array.isArray(savedSettings.customThemes) && savedSettings.customThemes.length) setCustomThemes(savedSettings.customThemes);
      if (typeof savedSettings.modalTint === 'number') setModalTint(savedSettings.modalTint);
      if (savedSettings.separatorColorId) setSeparatorColorId(savedSettings.separatorColorId);
      if (savedSettings.view) setView(savedSettings.view);
      if (savedSettings.sortBy) setSortBy(savedSettings.sortBy);
      if (typeof savedSettings.noteSizeIdx === 'number') setNoteSizeIdx(savedSettings.noteSizeIdx);
      if (typeof savedSettings.textSizeIdx === 'number') setTextSizeIdx(savedSettings.textSizeIdx);
      if (savedSettings.defaultColor) setDefaultColor(savedSettings.defaultColor);
      if (typeof savedSettings.confirmDelete === 'boolean') setConfirmDelete(savedSettings.confirmDelete);
      if (typeof savedSettings.autoSave === 'boolean') setAutoSave(savedSettings.autoSave);
      if (typeof savedSettings.autoMoveCompleted === 'boolean') setAutoMoveCompleted(savedSettings.autoMoveCompleted);
      if (savedSettings.fontChoice && FONT_OPTIONS[savedSettings.fontChoice]) setFontChoice(savedSettings.fontChoice);
      if (typeof savedSettings.confirmOnClose === 'boolean') setConfirmOnClose(savedSettings.confirmOnClose);
      if (typeof savedSettings.fullScreenEditor === 'boolean') setFullScreenEditor(savedSettings.fullScreenEditor);
      if (typeof savedSettings.similarThreshold === 'number') setSimilarThreshold(savedSettings.similarThreshold);
      if (typeof savedSettings.pinEnabled === 'boolean') setPinEnabled(savedSettings.pinEnabled);
      if (typeof savedSettings.pin === 'string') setPin(savedSettings.pin);
      if (savedSettings.pinEnabled) setLocked(true);
    }
    setHydrated(true);
  }, []);

  useEffect(() => { if (!hydrated || !autoSave) return; if (saveLocal(NOTES_KEY, notes)) setLastSaved(JSON.stringify(notes)); }, [notes, hydrated, autoSave]);
  useEffect(() => {
    if (!hydrated) return;
    saveLocal(SETTINGS_KEY, { customColors, customThemes, activeThemeId, modalTint, separatorColorId, view, sortBy, noteSizeIdx, textSizeIdx, defaultColor, confirmDelete, autoSave, autoMoveCompleted, fontChoice, confirmOnClose, fullScreenEditor, similarThreshold, pinEnabled, pin });
  }, [customColors, customThemes, activeThemeId, modalTint, separatorColorId, view, sortBy, noteSizeIdx, textSizeIdx, defaultColor, confirmDelete, autoSave, autoMoveCompleted, fontChoice, confirmOnClose, fullScreenEditor, similarThreshold, pinEnabled, pin, hydrated]);

  useEffect(() => {
    function onKeyDown(e) {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
      else if (e.key.toLowerCase() === 's') { e.preventDefault(); saveCurrentNote(); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const liveNotes = useMemo(() => notes.filter((n) => !n.deletedAt && !n.hidden), [notes]);
  const hiddenNotes = useMemo(() => notes.filter((n) => n.hidden && !n.deletedAt), [notes]);
  const trashedNotes = useMemo(() => notes.filter((n) => n.deletedAt).sort((a, b) => b.deletedAt - a.deletedAt), [notes]);
  const unsavedChanges = JSON.stringify(notes) !== lastSaved;
  const colorOrder = useMemo(() => customColors.reduce((acc, c, i) => ({ ...acc, [c.id]: i }), {}), [customColors]);
  const editingNote = notes.find((n) => n.id === editingId) || null;

  useEffect(() => {
    if (editingNote) {
      setDraftTitle(editingNote.title);
      setDraftBody(editingNote.body);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, editingNote?.title, editingNote?.body]);

  const allTags = useMemo(() => {
    const set = new Set();
    liveNotes.forEach((n) => (n.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [liveNotes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = !q ? liveNotes : liveNotes.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || (n.checklist || []).some((it) => it.text.toLowerCase().includes(q)));
    if (selectedTagFilters.length > 0) {
      base = base.filter((n) => (n.tags || []).some((t) => selectedTagFilters.includes(t)));
    }
    const compare = (a, b) => {
      switch (sortBy) {
        case 'created-desc': return b.createdAt - a.createdAt;
        case 'created-asc': return a.createdAt - b.createdAt;
        case 'color': return (colorOrder[a.color] ?? 99) - (colorOrder[b.color] ?? 99);
        case 'title': return a.title.localeCompare(b.title);
        case 'updated-desc':
        default: return b.updatedAt - a.updatedAt;
      }
    };
    const sorted = [...base].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || compare(a, b));
    return sorted;
  }, [liveNotes, query, sortBy, colorOrder, selectedTagFilters]);

  const similarPairs = useMemo(() => {
    const withWords = liveNotes.map((n) => ({ note: n, words: wordsOf(n) }));
    const pairs = [];
    for (let i = 0; i < withWords.length; i++) {
      for (let j = i + 1; j < withWords.length; j++) {
        const score = jaccard(withWords[i].words, withWords[j].words);
        if (score >= similarThreshold) pairs.push({ a: withWords[i].note, b: withWords[j].note, score });
      }
    }
    return pairs.sort((x, y) => y.score - x.score);
  }, [liveNotes, similarThreshold]);

  function pushHistory() { setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), notes]); setFuture([]); }
  function undo() {
    setPast((p) => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      setFuture((f) => [notes, ...f]);
      setNotes(previous);
      return p.slice(0, -1);
    });
  }
  function redo() {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p, notes]);
      setNotes(next);
      return f.slice(1);
    });
  }
  function manualSave() {
    if (saveLocal(NOTES_KEY, notes)) { setLastSaved(JSON.stringify(notes)); setJustSaved(true); setTimeout(() => setJustSaved(false), 1400); }
  }
  function saveCurrentNote() {
    if (!editingNote) { manualSave(); return; }
    const updatedNotes = notes.map((n) => (n.id === editingNote.id ? { ...n, title: draftTitle, body: draftBody, updatedAt: Date.now() } : n));
    setNotes(updatedNotes);
    if (saveLocal(NOTES_KEY, updatedNotes)) {
      setLastSaved(JSON.stringify(updatedNotes));
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1400);
    }
    const savedNote = updatedNotes.find((n) => n.id === editingNote.id);
    if (savedNote) {
      setPreEditSnapshot({ id: savedNote.id, title: savedNote.title, body: savedNote.body, checklist: savedNote.checklist, color: savedNote.color, mode: savedNote.mode });
    }
  }

  function addNote() {
    pushHistory();
    const id = nextId.current++;
    const color = defaultColor === 'random' ? customColors[Math.floor(Math.random() * customColors.length)]?.id : defaultColor;
    const now = Date.now();
    setNotes((prev) => [{ id, title: '', body: '', mode: 'note', checklist: [], pinned: false, hidden: false, tags: [], color: color || customColors[0]?.id, createdAt: now, updatedAt: now }, ...prev]);
    setEditingId(id);
    requestAnimationFrame(() => titleRefs.current[id]?.focus());
  }

  function updateNote(id, patch) { setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n))); }
  function startEditing(note) {
    pushHistory();
    setEditingId(note.id);
    setPreEditSnapshot({ id: note.id, title: note.title, body: note.body, checklist: note.checklist, color: note.color, mode: note.mode });
    setNoteMenuOpen(false); setMenuColorExpanded(false); setMenuShareInfo(false); setPendingClose(false); setTitleFocused(false);
  }
  function noteChangedSincePreEdit() {
    if (!preEditSnapshot || !editingNote) return false;
    return (
      draftTitle !== preEditSnapshot.title ||
      draftBody !== preEditSnapshot.body ||
      editingNote.color !== preEditSnapshot.color ||
      editingNote.mode !== preEditSnapshot.mode ||
      JSON.stringify(editingNote.checklist) !== JSON.stringify(preEditSnapshot.checklist)
    );
  }
  function requestClose() {
    if (confirmOnClose && editingNote && noteChangedSincePreEdit()) { setPendingClose(true); return; }
    finalizeClose(false);
  }
  function finalizeClose(discard) {
    if (discard && preEditSnapshot) {
      updateNote(preEditSnapshot.id, { title: preEditSnapshot.title, body: preEditSnapshot.body, checklist: preEditSnapshot.checklist, color: preEditSnapshot.color, mode: preEditSnapshot.mode });
    } else {
      saveCurrentNote();
    }
    setEditingId(null);
    setNoteMenuOpen(false);
    setPendingClose(false);
    setPreEditSnapshot(null);
  }
  function openHiddenNotes() {
    if (pinEnabled) { setHiddenPinCheck(true); setHiddenPinEntry(''); setHiddenPinError(''); }
    else { setHiddenOpen(true); }
  }
  function confirmHiddenPin() {
    if (hiddenPinEntry === pin) { setHiddenPinCheck(false); setHiddenPinEntry(''); setHiddenOpen(true); }
    else { setHiddenPinError('Wrong PIN'); setHiddenPinEntry(''); }
  }
  function toggleChecklistItem(note, itemId) {
    pushHistory();
    setNotes((prev) => prev.map((n) => {
      if (n.id !== note.id) return n;
      const next = sortChecklistItems(n.checklist.map((it) => (it.id === itemId ? { ...it, checked: !it.checked } : it)));
      return { ...n, checklist: next, updatedAt: Date.now() };
    }));
  }
  function deleteChecklistItem(note, itemId) {
    pushHistory();
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, checklist: n.checklist.filter((it) => it.id !== itemId), updatedAt: Date.now() } : n)));
  }
  function updateChecklistItemText(note, itemId, text) {
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, checklist: n.checklist.map((it) => (it.id === itemId ? { ...it, text } : it)), updatedAt: Date.now() } : n)));
  }
  function addChecklistItem(note) {
    const input = addItemRefs.current[note.id];
    const val = input?.value.trim();
    if (!val) return;
    pushHistory();
    const newItem = { id: `i${nextItemId.current++}`, text: val, checked: false };
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, checklist: [...(n.checklist || []), newItem], updatedAt: Date.now() } : n)));
    if (input) input.value = '';
  }
  function setNoteColor(note, colorId) { pushHistory(); updateNote(note.id, { color: colorId }); setMenuColorExpanded(false); setNoteMenuOpen(false); }
  function toggleNoteMode(note) { pushHistory(); const order = ['note', 'list', 'both']; setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, mode: order[(order.indexOf(n.mode || 'note') + 1) % order.length], updatedAt: Date.now() } : n))); }
  function togglePin(note) { pushHistory(); updateNote(note.id, { pinned: !note.pinned }); setNoteMenuOpen(false); }
  function hideNote(note) { pushHistory(); updateNote(note.id, { hidden: true }); setEditingId(null); }
  function unhideNote(id) { pushHistory(); updateNote(id, { hidden: false }); }
  function addTag(note, tag) {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!clean) return;
    pushHistory();
    setNotes((prev) => prev.map((n) => (n.id === note.id && !n.tags.includes(clean) ? { ...n, tags: [...n.tags, clean], updatedAt: Date.now() } : n)));
  }
  function removeTag(note, tag) {
    pushHistory();
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, tags: n.tags.filter((t) => t !== tag), updatedAt: Date.now() } : n)));
  }
  function exportNoteAsText(note) {
    const lines = [note.title || 'Untitled', ''];
    if (note.body) lines.push(previewText(note.body).split('. ').join('.\n'), '');
    if (note.checklist && note.checklist.length) {
      note.checklist.forEach((it) => lines.push(`[${it.checked ? 'x' : ' '}] ${it.text}`));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(note.title || 'note').replace(/[^a-z0-9-_ ]/gi, '').trim() || 'note'}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setNoteMenuOpen(false);
  }

  function moveToTrash(id) {
    if (confirmDelete && !window.confirm('Move this note to Trash?')) return;
    pushHistory();
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, deletedAt: Date.now() } : n)));
    if (editingId === id) setEditingId(null);
    setNoteMenuOpen(false);
  }
  function restoreNote(id) { pushHistory(); setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, deletedAt: null } : n))); }
  function deleteForever(id) {
    if (!window.confirm('Permanently delete this note? This cannot be undone.')) return;
    pushHistory();
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }
  function emptyTrash() {
    if (trashedNotes.length === 0) return;
    if (!window.confirm(`Permanently delete all ${trashedNotes.length} note(s) in Trash?`)) return;
    pushHistory();
    setNotes((prev) => prev.filter((n) => !n.deletedAt));
  }

  function exportAll() {
    const payload = { version: 9, notes, customColors, customThemes, settings: { activeThemeId, modalTint, view, sortBy, noteSizeIdx, textSizeIdx, defaultColor, confirmDelete, autoSave, autoMoveCompleted, similarThreshold } };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `notes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }
  function triggerImport() { fileInputRef.current?.click(); }
  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const now = Date.now();
        const rawNotes = Array.isArray(parsed) ? parsed : parsed.notes;
        if (!Array.isArray(rawNotes)) throw new Error('no notes array');
        const cleaned = rawNotes.map((n) => ({
          id: typeof n.id === 'number' ? n.id : nextId.current++,
          title: typeof n.title === 'string' ? n.title : '',
          body: typeof n.body === 'string' ? n.body : '',
          checklist: Array.isArray(n.checklist) ? n.checklist.map((it) => ({ id: it.id || `i${nextItemId.current++}`, text: it.text || '', checked: !!it.checked })) : [],
          color: n.color || customColors[0]?.id,
          pinned: !!n.pinned,
          hidden: !!n.hidden,
          tags: Array.isArray(n.tags) ? n.tags : [],
          mode: n.mode === 'list' ? 'list' : 'note',
          createdAt: typeof n.createdAt === 'number' ? n.createdAt : now,
          updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : now,
          deletedAt: typeof n.deletedAt === 'number' ? n.deletedAt : null,
        }));
        pushHistory();
        setNotes(cleaned);
        nextId.current = Math.max(4, ...cleaned.map((n) => n.id + 1));
        const importedItemNums = cleaned.flatMap((n) => (n.checklist || []).map((it) => parseInt(String(it.id).replace(/\D/g, ''), 10) || 0));
        nextItemId.current = Math.max(nextItemId.current, ...importedItemNums, 0) + 1;
        if (!Array.isArray(parsed)) {
          if (Array.isArray(parsed.customColors) && parsed.customColors.length) setCustomColors(parsed.customColors);
          if (Array.isArray(parsed.customThemes) && parsed.customThemes.length) setCustomThemes(parsed.customThemes);
          const st = parsed.settings;
          if (st) {
            if (st.activeThemeId) setActiveThemeId(st.activeThemeId);
            if (typeof st.modalTint === 'number') setModalTint(st.modalTint);
            if (st.view) setView(st.view);
            if (st.sortBy) setSortBy(st.sortBy);
            if (typeof st.noteSizeIdx === 'number') setNoteSizeIdx(st.noteSizeIdx);
            if (typeof st.textSizeIdx === 'number') setTextSizeIdx(st.textSizeIdx);
            if (st.defaultColor) setDefaultColor(st.defaultColor);
            if (typeof st.confirmDelete === 'boolean') setConfirmDelete(st.confirmDelete);
            if (typeof st.autoSave === 'boolean') setAutoSave(st.autoSave);
            if (typeof st.autoMoveCompleted === 'boolean') setAutoMoveCompleted(st.autoMoveCompleted);
            if (typeof st.similarThreshold === 'number') setSimilarThreshold(st.similarThreshold);
          }
        }
      } catch {
        alert('Could not read that file — make sure it\'s a backup exported from this app.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function toggleStrike(note) {
    const ta = textareaRefs.current[note.id];
    if (!ta) return;
    const { selectionStart, selectionEnd, value } = ta;
    if (selectionStart === selectionEnd) return;
    const selected = value.slice(selectionStart, selectionEnd);
    const isStruck = selected.startsWith('~~') && selected.endsWith('~~');
    const replacement = isStruck ? selected.slice(2, -2) : `~~${selected}~~`;
    let newValue = value.slice(0, selectionStart) + replacement + value.slice(selectionEnd);
    if (autoMoveCompleted) newValue = reorderBodyByStrike(newValue);
    setDraftBody(newValue);
    requestAnimationFrame(() => { ta.focus(); if (!autoMoveCompleted) ta.setSelectionRange(selectionStart, selectionStart + replacement.length); });
  }

  function saveCustomColor() {
    if (customColors.length >= MAX_CUSTOM) return;
    const [r, g, b] = hslToRgb(wheelHue, wheelSat, wheelLight);
    setCustomColors((prev) => [...prev, { id: `c${nextColorId.current++}`, hex: rgbToHex(r, g, b), label: `Color ${prev.length + 1}` }]);
  }
  function deleteCustomColor(id) { if (customColors.length <= 1) return; setCustomColors((prev) => prev.filter((c) => c.id !== id)); }
  function renameCustomColor(id, label) { setCustomColors((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c))); }

  function saveCustomTheme() {
    if (customThemes.length >= MAX_CUSTOM) return;
    const [r, g, b] = hslToRgb(themeWheelHue, themeWheelSat, themeWheelLight);
    const id = `t${nextThemeId.current++}`;
    setCustomThemes((prev) => [...prev, { id, label: `Theme ${prev.length + 1}`, hex: rgbToHex(r, g, b), cardLighter: themeCardLighter }]);
    setActiveThemeId(id);
  }
  function deleteCustomTheme(id) {
    if (customThemes.length <= 1) return;
    setCustomThemes((prev) => prev.filter((t) => t.id !== id));
    if (activeThemeId === id) setActiveThemeId(customThemes.find((t) => t.id !== id)?.id);
  }

  function savePin() {
    setPinSetupError('');
    if (newPin.length < 4) { setPinSetupError('PIN must be at least 4 digits'); return; }
    if (newPin !== confirmPin) { setPinSetupError('PINs do not match'); return; }
    setPin(newPin); setPinEnabled(true); setShowPinSetup(false); setNewPin(''); setConfirmPin('');
  }
  function removePin() { setPinEnabled(false); setPin(''); setShowPinSetup(false); }
  function tryUnlock() {
    if (pinEntry === pin) { setLocked(false); setPinEntry(''); setPinError(''); }
    else { setPinError('Wrong PIN'); setPinEntry(''); }
  }

  const { bg, text, elevated, muted, border: borderColor, isDark: dark } = theme;
  const { title: titleFont, body: bodyFont } = FONT_OPTIONS[fontChoice] || FONT_OPTIONS.classic;
  const borderStyle = `1px solid ${borderColor}`;
  const toolbarBtnStyle = (disabled) => ({
    width: 36, height: 36, borderRadius: 10, border: borderStyle, background: elevated, color: disabled ? muted : text,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer', position: 'relative', opacity: disabled ? 0.5 : 1,
  });
  const rangeAccentStyle = { accentColor: '#E8735F' };

  function titleKeyDown(e, note) { if (e.key === 'Enter') { e.preventDefault(); textareaRefs.current[note.id]?.focus(); } }

  function PreviewChecklist(note) {
    if (!note.checklist || note.checklist.length === 0) return null;
    const items = note.checklist.slice(0, 3);
    const remaining = note.checklist.length - items.length;
    return (
      <div style={{ marginTop: note.body ? 8 : 4 }}>
        {items.map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '3px 0' }}>
            <div style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${item.checked ? colorHexOf(note.color) : muted}`, background: item.checked ? colorHexOf(note.color) : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, pointerEvents: 'none' }}>
              {item.checked && <Check size={12} color="#fff" strokeWidth={3} />}
            </div>
            <span style={{ fontSize: fz(14), textDecoration: item.checked ? 'line-through' : 'none', opacity: item.checked ? 0.55 : 1 }}>{item.text}</span>
          </div>
        ))}
        {remaining > 0 && <div style={{ fontSize: fz(12), color: muted, marginTop: 2 }}>+{remaining} more</div>}
      </div>
    );
  }

  function NoteMenu(note) {
    if (!noteMenuOpen) return null;
    const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', color: text, cursor: 'pointer', padding: '9px 12px', fontSize: 14, textAlign: 'left', borderRadius: 8 };
    return (
      <>
        <div onClick={() => setNoteMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
        <div style={{ position: 'absolute', top: 34, right: 0, width: 230, maxHeight: 320, overflowY: 'auto', background: elevated, border: borderStyle, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', padding: 6, zIndex: 2 }}>
          <button onClick={() => togglePin(note)} style={rowStyle}><Pin size={15} /> {note.pinned ? 'Unpin note' : 'Pin note'}</button>
          <button onClick={() => hideNote(note)} style={rowStyle}><EyeOff size={15} /> Hide note</button>

          <div style={{ borderTop: borderStyle, borderBottom: borderStyle, margin: '4px 0' }}>
            <button onClick={() => setMenuColorExpanded((v) => !v)} style={rowStyle}><Palette size={15} /> Color</button>
            {menuColorExpanded && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 12px 8px' }}>
                {customColors.map((c) => (
                  <button key={c.id} onClick={() => setNoteColor(note, c.id)} title={c.label} style={{ width: 22, height: 22, borderRadius: '50%', background: c.hex, border: c.id === note.color ? `2px solid ${text}` : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                ))}
              </div>
            )}
          </div>

          <button onClick={() => exportNoteAsText(note)} style={rowStyle}><FileText size={15} /> Open as text file</button>

          <button onClick={() => { setSimilarOpen(true); setNoteMenuOpen(false); }} style={rowStyle}><GitCompare size={15} /> Similar notes</button>

          <button onClick={() => setMenuShareInfo((v) => !v)} style={rowStyle}><Share2 size={15} /> Share</button>
          {menuShareInfo && (
            <p style={{ fontSize: 11, color: muted, padding: '0 12px 8px', margin: 0 }}>
              Real-time sharing needs an account and sync system, which isn't built yet — noted for a later phase.
            </p>
          )}

          <button onClick={() => moveToTrash(note.id)} style={{ ...rowStyle, color: '#E8735F' }}><Trash2 size={15} /> Delete</button>
        </div>
      </>
    );
  }

  function EditorBody(note, colorHex, effectiveBg) {
    const noteText = contrastText(effectiveBg);
    const noteMuted = `${noteText}99`;
    const lineHeightPx = Math.round(fz(15) * 1.6);
    const mode = note.mode || 'note';
    const ruledBg = {
      backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${lineHeightPx - 1}px, ${colorHex}80 ${lineHeightPx - 1}px, ${colorHex}80 ${lineHeightPx}px)`,
      backgroundAttachment: 'local',
    };
    const checklistBlock = (
      <div style={{ flex: mode === 'both' ? '1 1 0' : '1 1 0', minHeight: 0, overflowY: 'auto', borderTop: mode === 'both' ? `1px solid ${noteText}30` : 'none', paddingTop: mode === 'both' ? 8 : 0 }}>
        {(note.checklist || []).map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '5px 0' }}>
            <Checkbox checked={item.checked} onToggle={() => toggleChecklistItem(note, item.id)} accent={colorHex} mutedColor={noteMuted} />
            <input
              value={item.text}
              onChange={(e) => updateChecklistItemText(note, item.id, e.target.value)}
              spellCheck={true}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: 0, fontSize: fz(15), color: noteText, textDecoration: item.checked ? 'line-through' : 'none', opacity: item.checked ? 0.55 : 1 }}
            />
            <button onClick={() => deleteChecklistItem(note, item.id)} aria-label="Remove item" title="Remove item" style={{ background: 'none', border: 'none', color: noteMuted, cursor: 'pointer', display: 'flex', padding: 0, flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>
        ))}
        {mode !== 'note' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <div style={{ width: 17, flexShrink: 0 }} />
            <input
              ref={(el) => (addItemRefs.current[note.id] = el)}
              placeholder="Add item + Enter"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(note); } }}
              spellCheck={true}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: 0, fontSize: fz(15), color: noteMuted }}
            />
          </div>
        )}
      </div>
    );
    return (
      <>
        {mode !== 'list' && (
          <div style={{ flex: mode === 'both' ? '4 1 0%' : '1 1 0%', minHeight: 0, overflowY: 'auto' }}>
            <textarea
              ref={(el) => (textareaRefs.current[note.id] = el)}
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              onBlur={() => {
                if (autoMoveCompleted) {
                  const reordered = reorderBodyByStrike(draftBody);
                  if (reordered !== draftBody) setDraftBody(reordered);
                }
              }}
              placeholder="Write something..."
              spellCheck={true}
              style={{
                width: '100%', height: '100%', minHeight: '100%', boxSizing: 'border-box', background: 'transparent', border: 'none', outline: 'none', resize: 'none',
                fontSize: fz(15), lineHeight: '1.6', color: noteText, padding: 0, ...ruledBg,
              }}
            />
          </div>
        )}

        {mode !== 'note' && checklistBlock}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: 8, gap: 10, flexShrink: 0 }}>
          <button onClick={undo} disabled={past.length === 0} aria-label="Undo" title="Undo" style={{ background: 'none', border: 'none', color: past.length === 0 ? `${noteText}50` : noteText, cursor: past.length === 0 ? 'default' : 'pointer', display: 'flex', padding: 2 }}>
            <Undo2 size={17} />
          </button>
          <button onClick={redo} disabled={future.length === 0} aria-label="Redo" title="Redo" style={{ background: 'none', border: 'none', color: future.length === 0 ? `${noteText}50` : noteText, cursor: future.length === 0 ? 'default' : 'pointer', display: 'flex', padding: 2 }}>
            <Redo2 size={17} />
          </button>
          {mode !== 'list' && (
            <button onClick={() => toggleStrike(note)} aria-label="Strikethrough selection" title="Strikethrough selection" style={{ background: 'none', border: 'none', color: noteText, cursor: 'pointer', display: 'flex', padding: 2 }}>
              <Strikethrough size={17} />
            </button>
          )}
        </div>
      </>
    );
  }

  function TagFooter(note, effectiveBg) {
    const noteText = contrastText(effectiveBg);
    return (
      <div style={{ minHeight: s(50), flexShrink: 0, borderTop: `1px solid ${noteText}30`, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', overflowY: 'auto' }}>
        {note.tags.map((tag) => (
          <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, background: `${noteText}22`, borderRadius: 999, padding: '4px 9px', color: noteText }}>
            <button onClick={() => { setSelectedTagFilters([tag]); setEditingId(null); }} style={{ background: 'none', border: 'none', color: noteText, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0, fontSize: 12 }}>
              # {tag}
            </button>
            <X size={11} style={{ cursor: 'pointer' }} onClick={() => removeTag(note, tag)} />
          </span>
        ))}
        <input
          ref={(el) => (tagInputRefs.current[note.id] = el)}
          placeholder="Add keyword + Enter"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const input = tagInputRefs.current[note.id];
              addTag(note, input.value);
              input.value = '';
            }
          }}
          style={{ flex: 1, minWidth: 100, background: 'transparent', border: 'none', outline: 'none', padding: 0, fontSize: 12, color: `${noteText}99` }}
        />
      </div>
    );
  }

  function PendingCloseOverlay(rounded) {
    if (!pendingClose) return null;
    return (
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', borderRadius: rounded ? 18 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: elevated, borderRadius: 14, padding: 20, width: '100%', maxWidth: 280, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: text, margin: '0 0 16px' }}>Save changes to this note?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => finalizeClose(false)} style={{ background: '#E8735F', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 12px', fontSize: 14, cursor: 'pointer' }}>Save & close</button>
            <button onClick={() => finalizeClose(true)} style={{ background: 'none', color: text, border: borderStyle, borderRadius: 10, padding: '9px 12px', fontSize: 14, cursor: 'pointer' }}>Discard changes</button>
            <button onClick={() => setPendingClose(false)} style={{ background: 'none', color: muted, border: 'none', borderRadius: 10, padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  function NoteEditorModal() {
    if (!editingNote) return null;
    const note = editingNote;
    const colorHex = colorHexOf(note.color);
    const modeLetter = note.mode === 'list' ? 'L' : note.mode === 'both' ? 'B' : 'N';

    if (fullScreenEditor) {
      const headerText = contrastText(colorHex);
      return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: bg, color: text, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flexShrink: 0, background: colorHex, display: 'flex', alignItems: 'center', gap: 8, padding: `${s(10)}px ${s(12)}px`, position: 'relative' }}>
            <button onClick={() => requestClose()} aria-label="Back" title="Back" style={{ background: 'none', border: 'none', color: headerText, cursor: 'pointer', display: 'flex', padding: 4 }}>
              <ArrowLeft size={20} />
            </button>
            <div style={{ flex: 1, background: titleFocused ? `${headerText}30` : 'transparent', borderRadius: 10, padding: '2px 4px', transition: 'background 0.15s ease' }}>
              <input
                ref={(el) => (titleRefs.current[note.id] = el)}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => titleKeyDown(e, note)}
                onFocus={() => setTitleFocused(true)}
                onBlur={() => setTitleFocused(false)}
                placeholder="Title"
                spellCheck={true}
                autoFocus
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontFamily: titleFont, fontWeight: 500, fontSize: fz(16), color: headerText, padding: '6px 8px' }}
              />
            </div>
            {note.pinned && <Pin size={16} style={{ color: headerText, opacity: 0.85, flexShrink: 0 }} />}
            <button onClick={() => toggleNoteMode(note)} aria-label="Switch List/Note mode" title="Switch List/Note mode" style={{ background: 'none', border: `1.5px solid ${headerText}80`, borderRadius: 6, width: 24, height: 24, color: headerText, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, padding: 0 }}>
              {modeLetter}
            </button>
            <button onClick={() => saveCurrentNote()} aria-label="Save" title="Save" style={{ background: 'none', border: 'none', color: justSaved ? '#DFF3E4' : headerText, cursor: 'pointer', display: 'flex', padding: 4, flexShrink: 0 }}>
              <Save size={20} />
            </button>
            <button onClick={() => setNoteMenuOpen((v) => !v)} aria-label="More options" title="More options" style={{ background: 'none', border: 'none', color: headerText, cursor: 'pointer', display: 'flex', padding: 4, flexShrink: 0 }}>
              <MoreVertical size={20} />
            </button>
            {NoteMenu(note)}
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: `${s(18)}px ${s(20)}px`, position: 'relative' }}>
            {EditorBody(note, colorHex, bg)}
          </div>
          {TagFooter(note, bg)}
          {PendingCloseOverlay(false)}
        </div>
      );
    }

    const panelBg = mixColors(colorHex, bg, modalTint / 100);
    const panelText = contrastText(panelBg);
    return (
      <div onClick={() => requestClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 60 }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 560, height: '86vh', borderRadius: 18,
            background: panelBg, border: `1px solid ${colorHex}70`,
            color: panelText, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', position: 'relative',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ padding: `${s(18)}px ${s(20)}px 0`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <button onClick={() => requestClose()} aria-label="Back" title="Back" style={{ background: 'none', border: 'none', color: panelText, cursor: 'pointer', display: 'flex', padding: 4, marginLeft: -4 }}>
                <ArrowLeft size={20} />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                {note.pinned && <Pin size={15} style={{ color: panelText, opacity: 0.7 }} />}
                <button onClick={() => toggleNoteMode(note)} aria-label="Switch List/Note mode" title="Switch List/Note mode" style={{ background: 'none', border: `1.5px solid ${panelText}60`, borderRadius: 6, width: 22, height: 22, color: panelText, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, padding: 0 }}>
                  {modeLetter}
                </button>
                <button onClick={() => saveCurrentNote()} aria-label="Save" title="Save" style={{ background: 'none', border: 'none', color: justSaved ? '#7FA671' : panelText, cursor: 'pointer', display: 'flex', padding: 4 }}>
                  <Save size={20} />
                </button>
                <button onClick={() => setNoteMenuOpen((v) => !v)} aria-label="More options" title="More options" style={{ background: 'none', border: 'none', color: panelText, cursor: 'pointer', display: 'flex', padding: 4 }}>
                  <MoreVertical size={20} />
                </button>
                {NoteMenu(note)}
              </div>
            </div>

            <input
              ref={(el) => (titleRefs.current[note.id] = el)}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => titleKeyDown(e, note)}
              placeholder="Title"
              spellCheck={true}
              autoFocus
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontFamily: titleFont, fontWeight: 500, fontSize: fz(24), color: panelText, marginBottom: 8, padding: 0 }}
            />
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: `0 ${s(20)}px` }}>
            {EditorBody(note, colorHex, panelBg)}
          </div>
          {TagFooter(note, panelBg)}
          {PendingCloseOverlay(true)}
        </div>
      </div>
    );
  }

  if (pinEnabled && locked) {
    return (
      <div style={{ minHeight: '100vh', background: bg, color: text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;1,9..144,500&family=Inter:wght@400;500;600&display=swap');`}</style>
        <div style={{ textAlign: 'center', width: 260 }}>
          <Lock size={28} style={{ marginBottom: 12, opacity: 0.7 }} />
          <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 24, margin: '0 0 16px' }}>Notes locked</h2>
          <input type="password" inputMode="numeric" value={pinEntry} onChange={(e) => setPinEntry(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && tryUnlock()} placeholder="Enter PIN" autoFocus style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center', fontSize: 20, letterSpacing: 4, padding: '10px 12px', borderRadius: 10, border: borderStyle, background: elevated, color: text, outline: 'none', marginBottom: 10 }} />
          {pinError && <div style={{ color: '#E8735F', fontSize: 13, marginBottom: 10 }}>{pinError}</div>}
          <button onClick={tryUnlock} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', background: '#E8735F', color: '#fff', fontSize: 14, cursor: 'pointer' }}>Unlock</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text, fontFamily: bodyFont, transition: 'background 0.3s, color 0.3s' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;1,9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .note-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .note-card:hover { transform: translateY(-2px) rotate(-0.3deg); }
        .note-row:hover { filter: brightness(1.08); }
        textarea, input, select { font-family: inherit; }
        ::selection { background: #E8735F55; }
        ::placeholder { color: ${muted}; opacity: 1; }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: `32px 24px ${allTags.length > 0 ? 184 : 120}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 34, margin: 0, letterSpacing: '-0.01em' }}>Notes</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 720, minWidth: 200, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {searchOpen || query ? (
              <div style={{ position: 'relative', flex: 1, minWidth: 140 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: muted }} />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onBlur={() => { if (!query) setSearchOpen(false); }}
                  placeholder="Search notes"
                  style={{ width: '100%', boxSizing: 'border-box', background: elevated, color: text, border: borderStyle, borderRadius: 10, padding: '9px 12px 9px 34px', fontSize: 14, outline: 'none' }}
                />
              </div>
            ) : (
              <button onClick={() => setSearchOpen(true)} aria-label="Search notes" title="Search notes" style={toolbarBtnStyle(false)}><Search size={16} /></button>
            )}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort notes by" style={{ background: elevated, color: text, border: borderStyle, borderRadius: 10, padding: '9px 10px', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
              {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>

            <div style={{ display: 'flex', border: borderStyle, borderRadius: 10, overflow: 'hidden' }}>
              <button onClick={() => setView('grid')} aria-label="Grid view" title="Grid view" style={{ width: 36, height: 36, border: 'none', cursor: 'pointer', background: view === 'grid' ? borderColor : elevated, color: text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LayoutGrid size={16} /></button>
              <button onClick={() => setView('list')} aria-label="List view" title="List view" style={{ width: 36, height: 36, border: 'none', cursor: 'pointer', background: view === 'list' ? borderColor : elevated, color: text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Rows3 size={16} /></button>
            </div>

            <button onClick={() => setSimilarOpen(true)} aria-label="Find similar notes" title="Find similar notes" style={toolbarBtnStyle(false)}>
              <GitCompare size={16} />
              {similarPairs.length > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#E8735F', color: '#fff', borderRadius: 999, fontSize: 9, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{similarPairs.length}</span>}
            </button>
            {pinEnabled && <button onClick={() => setLocked(true)} aria-label="Lock now" title="Lock now" style={toolbarBtnStyle(false)}><Lock size={16} /></button>}
            <button onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings" style={toolbarBtnStyle(false)}><Settings size={16} /></button>
          </div>
        </div>

        {filtered.length === 0 && (
          <div style={{ color: muted, fontSize: 14, padding: '40px 0', textAlign: 'center' }}>{query ? `Nothing matches "${query}"` : 'No notes yet — tap + to start one'}</div>
        )}

        {view === 'grid' ? (
          <div style={{ columns: `${s(220)}px`, columnGap: 16 }}>
            {filtered.map((note) => {
              const colorHex = colorHexOf(note.color);
              const cardBg = colorHex;
              const noteText = contrastText(cardBg);
              return (
                <div
                  key={note.id}
                  className="note-card"
                  style={{
                    breakInside: 'avoid', marginBottom: 16, borderRadius: 14, padding: `${s(16)}px ${s(16)}px ${s(12)}px`,
                    background: cardBg, border: `1px solid ${colorHex}70`,
                    boxShadow: dark ? '0 1px 2px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.06)', cursor: 'pointer', position: 'relative', color: noteText,
                  }}
                  onClick={() => startEditing(note)}
                >
                  {note.pinned && <Pin size={13} style={{ position: 'absolute', top: 10, right: 10, opacity: 0.6, color: noteText }} />}
                  <div style={{ fontFamily: titleFont, fontWeight: 500, fontSize: fz(17), marginBottom: 4, paddingRight: note.pinned ? 16 : 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{note.title || <span style={{ color: `${noteText}80` }}>Untitled</span>}</div>
                  {(() => {
                    const plan = previewPlan(note);
                    return (
                      <>
                        {plan.showBody && note.body && (
                          <div style={{ fontSize: fz(14), lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {previewText(note.body)}
                          </div>
                        )}
                        {plan.showChecklist && (note.checklist || []).length > 0 && PreviewChecklist(note)}
                      </>
                    );
                  })()}
                  {note.tags && note.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, marginTop: 8, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {note.tags.map((tag) => (
                        <button
                          key={tag}
                          onClick={(e) => { e.stopPropagation(); setSelectedTagFilters([tag]); }}
                          style={{ fontSize: fz(11), color: `${noteText}90`, background: `${noteText}18`, border: 'none', borderRadius: 999, padding: '2px 7px', flexShrink: 0, cursor: 'pointer' }}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ borderRadius: 12, overflow: 'hidden', border: borderStyle }}>
            {filtered.map((note, idx) => {
              const colorHex = colorHexOf(note.color);
              const rowBg = colorHex;
              const noteText = contrastText(rowBg);
              const sepHex = separatorColorId !== 'none' ? colorHexOf(separatorColorId) : null;
              return (
                <div key={note.id} className="note-row" style={{ display: 'flex', borderTop: idx === 0 ? 'none' : (sepHex ? `2px solid ${sepHex}` : borderStyle), background: rowBg, cursor: 'pointer', color: noteText }} onClick={() => startEditing(note)}>
                  <div style={{ width: 4, flexShrink: 0, background: colorHex }} />
                  <div style={{ flex: 1, padding: `${s(14)}px ${s(16)}px` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontFamily: titleFont, fontWeight: 500, fontSize: fz(17), display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {note.pinned && <Pin size={13} style={{ opacity: 0.6, flexShrink: 0 }} />}
                        {note.title || <span style={{ color: `${noteText}80` }}>Untitled</span>}
                      </span>
                      <span style={{ fontSize: fz(12), color: `${noteText}99`, whiteSpace: 'nowrap', flexShrink: 0 }}>{formatDate(note.updatedAt)}</span>
                    </div>
                    {(() => {
                      const plan = previewPlan(note);
                      return (
                        <>
                          {plan.showChecklist && (note.checklist || []).length > 0 && (
                            <div style={{ fontSize: fz(13), color: `${noteText}99`, marginTop: 2, whiteSpace: plan.showBody ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {(note.checklist || []).slice(0, 3).map((it) => it.text).join(', ')}{(note.checklist || []).length > 3 ? '…' : ''}
                            </div>
                          )}
                          {plan.showBody && note.body && (
                            <div style={{ fontSize: fz(13), color: `${noteText}99`, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {previewText(note.body)}
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {note.tags && note.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 5, marginTop: 6, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {note.tags.map((tag) => (
                          <button
                            key={tag}
                            onClick={(e) => { e.stopPropagation(); setSelectedTagFilters([tag]); }}
                            style={{ fontSize: fz(11), color: `${noteText}90`, background: `${noteText}18`, border: 'none', borderRadius: 999, padding: '2px 7px', flexShrink: 0, cursor: 'pointer' }}
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={addNote} aria-label="Add note" style={{ position: 'fixed', bottom: allTags.length > 0 ? 92 : 28, right: 28, width: 56, height: 56, borderRadius: '50%', background: '#E8735F', color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(232,115,95,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
        <Plus size={24} />
      </button>

      {allTags.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 64, background: elevated, borderTop: borderStyle, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', overflowX: 'auto', zIndex: 9 }}>
          {selectedTagFilters.length > 0 && (
            <button onClick={() => setSelectedTagFilters([])} aria-label="Clear keyword filters" title="Clear keyword filters" style={{ flexShrink: 0, background: 'none', border: borderStyle, borderRadius: 999, padding: '6px 10px', fontSize: 12, color: muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={12} /> Clear
            </button>
          )}
          {allTags.map((tag) => {
            const active = selectedTagFilters.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => setSelectedTagFilters((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))}
                style={{
                  flexShrink: 0, background: active ? '#E8735F' : bg, color: active ? '#fff' : text, border: active ? 'none' : borderStyle,
                  borderRadius: 999, padding: '6px 12px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                # {tag}
              </button>
            );
          })}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} style={{ display: 'none' }} />

      {NoteEditorModal()}

      {settingsOpen && (
        <div onClick={() => { setSettingsOpen(false); setSettingsSection(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, maxHeight: '88vh', overflowY: 'auto', background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {settingsSection && (
                  <button onClick={() => setSettingsSection(null)} aria-label="Back to settings" title="Back to settings" style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', display: 'flex', padding: 0 }}>
                    <ArrowLeft size={18} />
                  </button>
                )}
                <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 22, margin: 0 }}>
                  {settingsSection === 'colors' ? 'Colors' : settingsSection === 'text' ? 'Text' : settingsSection === 'other' ? 'Other' : 'Settings'}
                </h2>
              </div>
              <button onClick={() => { setSettingsOpen(false); setSettingsSection(null); }} aria-label="Close settings" title="Close settings" style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>

            {!settingsSection && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => setSettingsSection('colors')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '12px 14px', fontSize: 15, cursor: 'pointer' }}>
                  <Palette size={17} /> <span style={{ flex: 1, textAlign: 'left' }}>Colors</span> <ChevronRight size={16} style={{ color: muted }} />
                </button>
                <button onClick={() => setSettingsSection('text')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '12px 14px', fontSize: 15, cursor: 'pointer' }}>
                  <Type size={17} /> <span style={{ flex: 1, textAlign: 'left' }}>Text</span> <ChevronRight size={16} style={{ color: muted }} />
                </button>
                <button onClick={() => setSettingsSection('other')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '12px 14px', fontSize: 15, cursor: 'pointer' }}>
                  <SlidersHorizontal size={17} /> <span style={{ flex: 1, textAlign: 'left' }}>Other</span> <ChevronRight size={16} style={{ color: muted }} />
                </button>
              </div>
            )}

            {settingsSection === 'colors' && (
              <>
                <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: borderStyle }}>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>Theme color (up to {MAX_CUSTOM})</label>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <ColorWheel size={130} hue={themeWheelHue} sat={themeWheelSat} onChange={(h, sat) => { setThemeWheelHue(h); setThemeWheelSat(sat); }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 130 }}>
                      <label style={{ fontSize: 11, color: muted }}>Lightness</label>
                      <LightnessSlider hue={themeWheelHue} sat={themeWheelSat} value={themeWheelLight} onChange={setThemeWheelLight} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setThemeCardLighter(true)} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: borderStyle, background: themeCardLighter ? borderColor : 'transparent', color: text, fontSize: 11, cursor: 'pointer' }}>Card lighter</button>
                        <button onClick={() => setThemeCardLighter(false)} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: borderStyle, background: !themeCardLighter ? borderColor : 'transparent', color: text, fontSize: 11, cursor: 'pointer' }}>Card darker</button>
                      </div>
                      <div style={{ width: '100%', height: 28, borderRadius: 8, background: rgbToHex(...hslToRgb(themeWheelHue, themeWheelSat, themeWheelLight)) }} />
                      <button onClick={saveCustomTheme} disabled={customThemes.length >= MAX_CUSTOM} style={{ padding: '7px 10px', borderRadius: 8, border: 'none', background: '#E8735F', color: '#fff', fontSize: 12, cursor: customThemes.length >= MAX_CUSTOM ? 'default' : 'pointer', opacity: customThemes.length >= MAX_CUSTOM ? 0.5 : 1 }}>
                        Save theme {customThemes.length + 1}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {customThemes.map((t) => {
                      const tc = computeThemeFromColor(t.hex, t.cardLighter);
                      return (
                        <div key={t.id} style={{ position: 'relative' }}>
                          <button onClick={() => setActiveThemeId(t.id)} title={t.label || 'Theme'} style={{ width: 38, height: 38, borderRadius: 10, background: tc.bg, border: activeThemeId === t.id ? '2px solid #E8735F' : `1px solid ${tc.muted}`, cursor: 'pointer' }} />
                          {customThemes.length > 1 && (
                            <button onClick={() => deleteCustomTheme(t.id)} aria-label="Delete theme" title="Delete theme" style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: muted, border: 'none', color: elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><X size={10} /></button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 12, color: muted, marginTop: 6 }}>{activePreset.label}</div>

                  <label style={{ fontSize: 13, color: muted, display: 'block', margin: '16px 0 6px' }}>
                    Enlarged note transparency: {modalTint}%
                  </label>
                  <input type="range" min={5} max={100} value={modalTint} onChange={(e) => setModalTint(Number(e.target.value))} style={{ width: '100%', ...rangeAccentStyle }} />
                </div>

                <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: borderStyle }}>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>Note colors (up to {MAX_CUSTOM})</label>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <ColorWheel size={130} hue={wheelHue} sat={wheelSat} onChange={(h, sat) => { setWheelHue(h); setWheelSat(sat); }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 120 }}>
                      <label style={{ fontSize: 11, color: muted }}>Lightness</label>
                      <LightnessSlider hue={wheelHue} sat={wheelSat} value={wheelLight} onChange={setWheelLight} />
                      <div style={{ width: '100%', height: 28, borderRadius: 8, background: rgbToHex(...hslToRgb(wheelHue, wheelSat, wheelLight)) }} />
                      <button onClick={saveCustomColor} disabled={customColors.length >= MAX_CUSTOM} style={{ padding: '7px 10px', borderRadius: 8, border: 'none', background: '#E8735F', color: '#fff', fontSize: 12, cursor: customColors.length >= MAX_CUSTOM ? 'default' : 'pointer', opacity: customColors.length >= MAX_CUSTOM ? 0.5 : 1 }}>
                        Save color {customColors.length + 1}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                    {customColors.map((c) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: c.hex, flexShrink: 0 }} />
                        <input value={c.label} onChange={(e) => renameCustomColor(c.id, e.target.value)} style={{ flex: 1, background: bg, border: borderStyle, borderRadius: 8, padding: '5px 8px', fontSize: 12, color: text, outline: 'none' }} />
                        {customColors.length > 1 && (
                          <button onClick={() => deleteCustomColor(c.id)} aria-label="Delete color" title="Delete color" style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex', padding: 2 }}><X size={13} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 4 }}>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>Default color for new notes</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button onClick={() => setDefaultColor('random')} title="Random" style={{ width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', background: 'conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red)', border: defaultColor === 'random' ? `2px solid ${text}` : '2px solid transparent' }} />
                    {customColors.map((c) => (
                      <button key={c.id} onClick={() => setDefaultColor(c.id)} title={c.label} style={{ width: 26, height: 26, borderRadius: '50%', background: c.hex, cursor: 'pointer', border: defaultColor === c.id ? `2px solid ${text}` : '2px solid transparent' }} />
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 4 }}>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>List separator color</label>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 12 }}>
                    <ColorWheel size={110} hue={wheelHue} sat={wheelSat} onChange={(h, sat) => { setWheelHue(h); setWheelSat(sat); }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 120 }}>
                      <label style={{ fontSize: 11, color: muted }}>Lightness</label>
                      <LightnessSlider hue={wheelHue} sat={wheelSat} value={wheelLight} onChange={setWheelLight} />
                      <button
                        onClick={() => {
                          if (customColors.length >= MAX_CUSTOM) return;
                          const [r, g, b] = hslToRgb(wheelHue, wheelSat, wheelLight);
                          const hex = rgbToHex(r, g, b);
                          const id = `c${nextColorId.current++}`;
                          setCustomColors((prev) => [...prev, { id, hex, label: `Color ${prev.length + 1}` }]);
                          setSeparatorColorId(id);
                        }}
                        disabled={customColors.length >= MAX_CUSTOM}
                        style={{ padding: '7px 10px', borderRadius: 8, border: 'none', background: '#E8735F', color: '#fff', fontSize: 12, cursor: customColors.length >= MAX_CUSTOM ? 'default' : 'pointer', opacity: customColors.length >= MAX_CUSTOM ? 0.5 : 1 }}
                      >
                        Save & use for dividers
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button onClick={() => setSeparatorColorId('none')} title="None" style={{ width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', background: 'transparent', border: separatorColorId === 'none' ? `2px solid ${text}` : borderStyle }} />
                    {customColors.map((c) => (
                      <button key={c.id} onClick={() => setSeparatorColorId(c.id)} title={c.label} style={{ width: 26, height: 26, borderRadius: '50%', background: c.hex, cursor: 'pointer', border: separatorColorId === c.id ? `2px solid ${text}` : '2px solid transparent' }} />
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: muted, margin: '8px 0 0' }}>Only shown in list view — grid view doesn't use a separator.</p>
                </div>
              </>
            )}

            {settingsSection === 'text' && (
              <>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>Font</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {Object.entries(FONT_OPTIONS).map(([id, f]) => (
                      <button key={id} onClick={() => setFontChoice(id)} style={{ padding: '8px 12px', borderRadius: 10, border: fontChoice === id ? '2px solid #E8735F' : borderStyle, background: bg, color: text, fontFamily: f.title, fontSize: 14, cursor: 'pointer' }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>Text size</label>
                  <div style={{ display: 'flex', alignItems: 'center', border: borderStyle, borderRadius: 10, overflow: 'hidden', width: 'fit-content' }}>
                    <button onClick={() => setTextSizeIdx((i) => Math.max(0, i - 1))} aria-label="Decrease text size" title="Decrease text size" disabled={textSizeIdx === 0} style={{ width: 32, height: 34, border: 'none', cursor: textSizeIdx === 0 ? 'default' : 'pointer', background: bg, color: textSizeIdx === 0 ? muted : text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={14} /></button>
                    <span style={{ fontSize: 12, color: muted, padding: '0 10px', minWidth: 80, textAlign: 'center', textTransform: 'capitalize' }}>{SIZE_STEPS[textSizeIdx]}</span>
                    <button onClick={() => setTextSizeIdx((i) => Math.min(SIZE_STEPS.length - 1, i + 1))} aria-label="Increase text size" title="Increase text size" disabled={textSizeIdx === SIZE_STEPS.length - 1} style={{ width: 32, height: 34, border: 'none', cursor: textSizeIdx === SIZE_STEPS.length - 1 ? 'default' : 'pointer', background: bg, color: textSizeIdx === SIZE_STEPS.length - 1 ? muted : text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PlusIcon size={14} /></button>
                  </div>
                </div>

                <div style={{ marginBottom: 4 }}>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>Note size</label>
                  <div style={{ display: 'flex', alignItems: 'center', border: borderStyle, borderRadius: 10, overflow: 'hidden', width: 'fit-content' }}>
                    <button onClick={() => setNoteSizeIdx((i) => Math.max(0, i - 1))} aria-label="Decrease note size" title="Decrease note size" disabled={noteSizeIdx === 0} style={{ width: 32, height: 34, border: 'none', cursor: noteSizeIdx === 0 ? 'default' : 'pointer', background: bg, color: noteSizeIdx === 0 ? muted : text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={14} /></button>
                    <span style={{ fontSize: 12, color: muted, padding: '0 10px', minWidth: 80, textAlign: 'center', textTransform: 'capitalize' }}>{SIZE_STEPS[noteSizeIdx]}</span>
                    <button onClick={() => setNoteSizeIdx((i) => Math.min(SIZE_STEPS.length - 1, i + 1))} aria-label="Increase note size" title="Increase note size" disabled={noteSizeIdx === SIZE_STEPS.length - 1} style={{ width: 32, height: 34, border: 'none', cursor: noteSizeIdx === SIZE_STEPS.length - 1 ? 'default' : 'pointer', background: bg, color: noteSizeIdx === SIZE_STEPS.length - 1 ? muted : text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PlusIcon size={14} /></button>
                  </div>
                </div>
              </>
            )}

            {settingsSection === 'other' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 6 }}>Similar-notes sensitivity: {Math.round(similarThreshold * 100)}% shared words</label>
                  <input type="range" min={5} max={50} value={Math.round(similarThreshold * 100)} onChange={(e) => setSimilarThreshold(Number(e.target.value) / 100)} style={{ width: '100%', ...rangeAccentStyle }} />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={autoMoveCompleted} onChange={(e) => setAutoMoveCompleted(e.target.checked)} />
                  Auto-move crossed-out text to the bottom (checklist items always do this)
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={fullScreenEditor} onChange={(e) => setFullScreenEditor(e.target.checked)} />
                  Full-screen note editor (colored header bar, like ColorNote)
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={confirmOnClose} onChange={(e) => setConfirmOnClose(e.target.checked)} />
                  Ask to save before closing an edited note
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={confirmDelete} onChange={(e) => setConfirmDelete(e.target.checked)} />
                  Ask for confirmation before moving a note to Trash
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 20, cursor: 'pointer' }}>
                  <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} />
                  Auto-save notes as I type
                </label>
                {!autoSave && <p style={{ fontSize: 12, color: muted, margin: '-14px 0 20px' }}>Auto-save is off — changes are kept in the app but won't survive a refresh until you save from within a note.</p>}

                <div style={{ borderTop: borderStyle, paddingTop: 16, marginBottom: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={pinEnabled} onChange={(e) => { if (e.target.checked) setShowPinSetup(true); else removePin(); }} />
                    Lock the app with a PIN
                  </label>
                  {showPinSetup && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input type="password" inputMode="numeric" placeholder="New PIN (4+ digits)" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} style={{ background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '8px 10px', fontSize: 14, outline: 'none' }} />
                      <input type="password" inputMode="numeric" placeholder="Confirm PIN" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} style={{ background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '8px 10px', fontSize: 14, outline: 'none' }} />
                      {pinSetupError && <div style={{ color: '#E8735F', fontSize: 12 }}>{pinSetupError}</div>}
                      <button onClick={savePin} style={{ background: '#E8735F', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 12px', fontSize: 14, cursor: 'pointer' }}>Save PIN</button>
                    </div>
                  )}
                  {pinEnabled && !showPinSetup && <button onClick={removePin} style={{ marginTop: 8, background: 'none', border: 'none', color: muted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Remove PIN</button>}
                  <p style={{ fontSize: 11, color: muted, margin: '8px 0 0' }}>This locks the app screen only — it's a basic deterrent, not real encryption.</p>

                  <button onClick={openHiddenNotes} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '9px 12px', fontSize: 14, cursor: 'pointer', width: '100%' }}>
                    <EyeOff size={15} /> Hidden notes{hiddenNotes.length > 0 ? ` (${hiddenNotes.length})` : ''}{pinEnabled ? ' — PIN required' : ''}
                  </button>
                  <button onClick={() => setTrashOpen(true)} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '9px 12px', fontSize: 14, cursor: 'pointer', width: '100%' }}>
                    <Archive size={15} /> Trash{trashedNotes.length > 0 ? ` (${trashedNotes.length})` : ''}
                  </button>
                </div>

                <div style={{ borderTop: borderStyle, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 13, color: muted, marginBottom: -2 }}>Backup (notes, colors, settings)</label>
                  <button onClick={exportAll} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '10px 12px', fontSize: 14, cursor: 'pointer' }}><Download size={15} /> Export backup (.json)</button>
                  <button onClick={triggerImport} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '10px 12px', fontSize: 14, cursor: 'pointer' }}><Upload size={15} /> Import backup (.json)</button>
                  <p style={{ fontSize: 12, color: muted, margin: '4px 0 0' }}>Importing replaces all current notes — export first if you want a copy of what's there now.</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {trashOpen && (
        <div onClick={() => setTrashOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto', background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 22, margin: 0 }}>Trash</h2>
              <button onClick={() => setTrashOpen(false)} aria-label="Close trash" title="Close trash" style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>
            {trashedNotes.length === 0 ? (
              <p style={{ color: muted, fontSize: 14 }}>Trash is empty.</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {trashedNotes.map((note) => {
                    const colorHex = colorHexOf(note.color);
                    return (
                      <div key={note.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, background: dark ? `${colorHex}1A` : `${colorHex}17`, border: `1px solid ${colorHex}40` }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: colorHex, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title || 'Untitled'}</div>
                          <div style={{ fontSize: 12, color: muted }}>Deleted {formatDate(note.deletedAt)}</div>
                        </div>
                        <button onClick={() => restoreNote(note.id)} aria-label="Restore note" title="Restore" style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', display: 'flex', padding: 4 }}><RotateCcw size={16} /></button>
                        <button onClick={() => deleteForever(note.id)} aria-label="Delete forever" title="Delete forever" style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex', padding: 4 }}><Trash2 size={16} /></button>
                      </div>
                    );
                  })}
                </div>
                <button onClick={emptyTrash} style={{ width: '100%', background: 'none', border: '1px solid #E8735F80', color: '#E8735F', borderRadius: 10, padding: '9px 12px', fontSize: 14, cursor: 'pointer' }}>Empty Trash</button>
              </>
            )}
          </div>
        </div>
      )}

      {hiddenPinCheck && (
        <div onClick={() => setHiddenPinCheck(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 55 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 280, background: elevated, borderRadius: 14, border: borderStyle, padding: 20, color: text, textAlign: 'center' }}>
            <Lock size={22} style={{ marginBottom: 10, opacity: 0.7 }} />
            <p style={{ fontSize: 14, margin: '0 0 10px' }}>Enter PIN to view hidden notes</p>
            <input
              type="password" inputMode="numeric" value={hiddenPinEntry}
              onChange={(e) => setHiddenPinEntry(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && confirmHiddenPin()}
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center', fontSize: 18, letterSpacing: 3, padding: '8px 10px', borderRadius: 10, border: borderStyle, background: bg, color: text, outline: 'none', marginBottom: 8 }}
            />
            {hiddenPinError && <div style={{ color: '#E8735F', fontSize: 12, marginBottom: 8 }}>{hiddenPinError}</div>}
            <button onClick={confirmHiddenPin} style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none', background: '#E8735F', color: '#fff', fontSize: 14, cursor: 'pointer' }}>Unlock</button>
          </div>
        </div>
      )}

      {hiddenOpen && (
        <div onClick={() => setHiddenOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto', background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 22, margin: 0 }}>Hidden notes</h2>
              <button onClick={() => setHiddenOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>
            {hiddenNotes.length === 0 ? (
              <p style={{ color: muted, fontSize: 14 }}>No hidden notes.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {hiddenNotes.map((note) => {
                  const colorHex = colorHexOf(note.color);
                  return (
                    <div key={note.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, background: dark ? `${colorHex}1A` : `${colorHex}17`, border: `1px solid ${colorHex}40`, cursor: 'pointer' }} onClick={() => { setHiddenOpen(false); startEditing(note); }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: colorHex, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title || 'Untitled'}</div>
                      <button onClick={(e) => { e.stopPropagation(); unhideNote(note.id); }} aria-label="Unhide note" title="Unhide" style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', display: 'flex', padding: 4 }}><Eye size={16} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {similarOpen && (
        <div onClick={() => setSimilarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, maxHeight: '80vh', overflowY: 'auto', background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 22, margin: 0 }}>Similar notes</h2>
              <button onClick={() => setSimilarOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>
            {similarPairs.length === 0 ? (
              <p style={{ color: muted, fontSize: 14 }}>No likely duplicates found at the current {Math.round(similarThreshold * 100)}% sensitivity.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {similarPairs.map((pair, i) => (
                  <div key={i} style={{ border: borderStyle, borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12, color: muted, marginBottom: 6 }}>{Math.round(pair.score * 100)}% similar</div>
                    {[pair.a, pair.b].map((n) => (
                      <button key={n.id} onClick={() => { startEditing(n); setSimilarOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: text, cursor: 'pointer', padding: '4px 0', fontSize: 14 }}>
                        <strong>{n.title || 'Untitled'}</strong>
                        <div style={{ fontSize: 12, color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewText(n.body)}</div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
