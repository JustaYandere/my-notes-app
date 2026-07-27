import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search, Plus, Trash2, LayoutGrid, Rows3, Minus, PlusIcon,
  Settings, Download, Upload, X, Lock,
  GitCompare, RotateCcw, Archive, Check, Undo2, Redo2, Save, ArrowLeft,
  MoreVertical, Pin, EyeOff, Eye, FileText, Share2, Palette, Type, SlidersHorizontal, ChevronRight, Paintbrush, Square, Maximize2,
  CloudRain, Sparkles, Image as ImageIcon, Ban, Bell, BellOff, Mic, User, Users, Music,
} from 'lucide-react';

import { hslToRgb, rgbToHex, mixColors, computeThemeFromColor, contrastText } from './utils/colorMath';
import {
  loadLocal, saveLocal, formatDate, previewText,
  wordsOf, jaccard, sortChecklistItems, reorderBodyByStrike, previewPlan,
} from './utils/noteHelpers';
import {
  FONT_OPTIONS, STARTER_COLORS, STARTER_THEMES, SEED_NOTES, SORT_OPTIONS, SIZE_STEPS, SCALE_MAP,
  NOTES_KEY, SETTINGS_KEY, LEGACY_NOTES_KEY, LEGACY_SETTINGS_KEY, MAX_HISTORY, MAX_CUSTOM,
} from './constants';
import ColorWheel from './components/ColorWheel';
import LightnessSlider from './components/LightnessSlider';
import Checkbox from './components/Checkbox';
import MainBackdrop from './components/MainBackdrop';
import VoiceNotes from './components/VoiceNotes';
import AccountPanel from './components/AccountPanel';
import ConnectedAccounts from './components/ConnectedAccounts';
import ShareNotePicker from './components/ShareNotePicker';
import ConnectedNotesModal from './components/ConnectedNotesModal';
import AmbientAudio from './components/AmbientAudio';
import { useNotesSync } from './hooks/useNotesSync';
import { useSettingsSync } from './hooks/useSettingsSync';

export default function NotesApp() {
  const [hydrated, setHydrated] = useState(false);
  const [customColors, setCustomColors] = useState(STARTER_COLORS);
  const [separatorColors, setSeparatorColors] = useState(STARTER_COLORS);
  const [activeThemeId, setActiveThemeId] = useState('black');
  const [customThemes, setCustomThemes] = useState(STARTER_THEMES);
  const [themeWheelHue, setThemeWheelHue] = useState(220);
  const [themeWheelSat, setThemeWheelSat] = useState(0.4);
  const [themeWheelLight, setThemeWheelLight] = useState(0.15);
  const [themeCardLighter, setThemeCardLighter] = useState(true);
  const [modalTint, setModalTint] = useState(100);
  const [separatorColorId, setSeparatorColorId] = useState('none');
  const [titleFocused, setTitleFocused] = useState(false);
  const [mainBgEffect, setMainBgEffect] = useState('color');
  const [mainBgImage, setMainBgImage] = useState(null);
  const [syncUser, setSyncUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [shareColors, setShareColors] = useState(false);

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
  const [connectedNotesOpen, setConnectedNotesOpen] = useState(false);
  const [newNoteSetupOpen, setNewNoteSetupOpen] = useState(false);
  const [pendingNoteColor, setPendingNoteColor] = useState(null);
  const [pendingNoteMode, setPendingNoteMode] = useState('note');
  const [ambientSound, setAmbientSound] = useState('none');
  const [ambientSoundData, setAmbientSoundData] = useState(null);
  const [ambientSoundName, setAmbientSoundName] = useState('');
  const [ambientVolume, setAmbientVolume] = useState(0.5);
  const [noteMenuOpen, setNoteMenuOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [menuShareInfo, setMenuShareInfo] = useState(false);
  const [menuReminderExpanded, setMenuReminderExpanded] = useState(false);
  const [selectedTagFilters, setSelectedTagFilters] = useState([]);
  const [tagFilterMode, setTagFilterMode] = useState('any');

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
  const [justSaved, setJustSaved] = useState(false);

  const [wheelHue, setWheelHue] = useState(200);
  const [wheelSat, setWheelSat] = useState(0.6);
  const [wheelLight, setWheelLight] = useState(0.55);
  const [sepWheelHue, setSepWheelHue] = useState(200);
  const [sepWheelSat, setSepWheelSat] = useState(0.6);
  const [sepWheelLight, setSepWheelLight] = useState(0.55);

  const nextId = useRef(4);
  const nextItemId = useRef(10);
  const nextColorId = useRef(5);
  const nextSepColorId = useRef(5);
  const nextThemeId = useRef(2);
  const fileInputRef = useRef(null);
  const bgImageInputRef = useRef(null);
  const ambientSoundInputRef = useRef(null);
  const textareaRefs = useRef({});
  const titleRefs = useRef({});
  const addItemRefs = useRef({});
  const tagInputRefs = useRef({});
  const { deleteCloudNote } = useNotesSync({ notes, setNotes, syncUser, nextIdRef: nextId, setSyncStatus });
  useSettingsSync({
    values: { customColors, customThemes, activeThemeId, modalTint, separatorColorId, mainBgEffect, mainBgImage, fontChoice },
    setters: { customColors: setCustomColors, customThemes: setCustomThemes, activeThemeId: setActiveThemeId, modalTint: setModalTint, separatorColorId: setSeparatorColorId, mainBgEffect: setMainBgEffect, mainBgImage: setMainBgImage, fontChoice: setFontChoice },
    syncUser,
    enabled: shareColors,
  });
  const scale = SCALE_MAP[SIZE_STEPS[noteSizeIdx]];
  const textScale = SCALE_MAP[SIZE_STEPS[textSizeIdx]];
  const s = (n) => Math.round(n * scale);
  const fz = (n) => Math.round(n * textScale);

  const activePreset = customThemes.find((t) => t.id === activeThemeId) || customThemes[0];
  const theme = computeThemeFromColor(activePreset.hex, activePreset.cardLighter);

  function colorHexOf(colorId) { return customColors.find((c) => c.id === colorId)?.hex || customColors[0]?.hex || '#5B9BB8'; }

  useEffect(() => {
    let savedNotes = loadLocal(NOTES_KEY);
    if (!savedNotes) {
      const legacyNotes = loadLocal(LEGACY_NOTES_KEY);
      if (legacyNotes) { savedNotes = legacyNotes; saveLocal(NOTES_KEY, legacyNotes); }
    }
    if (Array.isArray(savedNotes) && savedNotes.length) {
      let initialNotes = savedNotes.map((n) => ({ checklist: [], pinned: false, hidden: false, tags: [], mode: 'note', voiceNotes: [], ...n }));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage on mount, not a render-driven sync
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
    let savedSettings = loadLocal(SETTINGS_KEY);
    if (!savedSettings) {
      const legacySettings = loadLocal(LEGACY_SETTINGS_KEY);
      if (legacySettings) { savedSettings = legacySettings; saveLocal(SETTINGS_KEY, legacySettings); }
    }
    if (savedSettings) {
      if (Array.isArray(savedSettings.customColors) && savedSettings.customColors.length) { setCustomColors(savedSettings.customColors); nextColorId.current = savedSettings.customColors.length + 1; }
      if (Array.isArray(savedSettings.separatorColors) && savedSettings.separatorColors.length) { setSeparatorColors(savedSettings.separatorColors); nextSepColorId.current = savedSettings.separatorColors.length + 1; }
      if (savedSettings.activeThemeId) setActiveThemeId(savedSettings.activeThemeId);
      if (Array.isArray(savedSettings.customThemes) && savedSettings.customThemes.length) setCustomThemes(savedSettings.customThemes);
      if (typeof savedSettings.modalTint === 'number') setModalTint(savedSettings.modalTint);
      if (savedSettings.separatorColorId) setSeparatorColorId(savedSettings.separatorColorId);
      if (savedSettings.mainBgEffect) setMainBgEffect(savedSettings.mainBgEffect);
      if (typeof savedSettings.mainBgImage === 'string') setMainBgImage(savedSettings.mainBgImage);
      if (savedSettings.ambientSound) setAmbientSound(savedSettings.ambientSound);
      if (typeof savedSettings.ambientSoundData === 'string') setAmbientSoundData(savedSettings.ambientSoundData);
      if (typeof savedSettings.ambientSoundName === 'string') setAmbientSoundName(savedSettings.ambientSoundName);
      if (typeof savedSettings.ambientVolume === 'number') setAmbientVolume(savedSettings.ambientVolume);
      if (typeof savedSettings.shareColors === 'boolean') setShareColors(savedSettings.shareColors);
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

  useEffect(() => {
    if (!hydrated || !autoSave) return;
    saveLocal(NOTES_KEY, notes);
  }, [notes, hydrated, autoSave]);
  useEffect(() => {
    if (!hydrated) return;
    saveLocal(SETTINGS_KEY, { customColors, customThemes, activeThemeId, modalTint, separatorColorId, separatorColors, mainBgEffect, mainBgImage, shareColors, ambientSound, ambientSoundData, ambientSoundName, ambientVolume, view, sortBy, noteSizeIdx, textSizeIdx, defaultColor, confirmDelete, autoSave, autoMoveCompleted, fontChoice, confirmOnClose, fullScreenEditor, similarThreshold, pinEnabled, pin });
  }, [customColors, customThemes, activeThemeId, modalTint, separatorColorId, separatorColors, mainBgEffect, mainBgImage, shareColors, ambientSound, ambientSoundData, ambientSoundName, ambientVolume, view, sortBy, noteSizeIdx, textSizeIdx, defaultColor, confirmDelete, autoSave, autoMoveCompleted, fontChoice, confirmOnClose, fullScreenEditor, similarThreshold, pinEnabled, pin, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    function checkReminders() {
      const now = Date.now();
      const due = notes.filter((n) => n.reminderAt && !n.reminderNotified && n.reminderAt <= now && !n.deletedAt);
      if (due.length === 0) return;
      setNotes((prev) => prev.map((n) => (due.some((d) => d.id === n.id) ? { ...n, reminderNotified: true } : n)));
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        due.forEach((n) => new Notification(n.title || 'Reminder', { body: previewText(n.body) || 'Note reminder' }));
      }
    }
    checkReminders();
    const interval = setInterval(checkReminders, 30000);
    return () => clearInterval(interval);
  }, [notes, hydrated]);

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
  const colorOrder = useMemo(() => customColors.reduce((acc, c, i) => ({ ...acc, [c.id]: i }), {}), [customColors]);
  const editingNote = notes.find((n) => n.id === editingId) || null;

  useEffect(() => {
    if (editingNote) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seeds the draft fields when a note is opened
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
      base = base.filter((n) => (
        tagFilterMode === 'all'
          ? selectedTagFilters.every((t) => (n.tags || []).includes(t))
          : (n.tags || []).some((t) => selectedTagFilters.includes(t))
      ));
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
  }, [liveNotes, query, sortBy, colorOrder, selectedTagFilters, tagFilterMode]);

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
    if (saveLocal(NOTES_KEY, notes)) { setJustSaved(true); setTimeout(() => setJustSaved(false), 1400); }
  }
  function saveCurrentNote() {
    if (!editingNote) { manualSave(); return; }
    const updatedNotes = notes.map((n) => (n.id === editingNote.id ? { ...n, title: draftTitle, body: draftBody, updatedAt: Date.now() } : n));
    setNotes(updatedNotes);
    if (saveLocal(NOTES_KEY, updatedNotes)) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1400);
    }
    const savedNote = updatedNotes.find((n) => n.id === editingNote.id);
    if (savedNote) {
      setPreEditSnapshot({ id: savedNote.id, title: savedNote.title, body: savedNote.body, checklist: savedNote.checklist, color: savedNote.color, mode: savedNote.mode });
    }
  }

  function openNewNoteSetup() {
    const color = defaultColor === 'random' ? customColors[Math.floor(Math.random() * customColors.length)]?.id : defaultColor;
    setPendingNoteColor(color || customColors[0]?.id);
    setPendingNoteMode('note');
    setNewNoteSetupOpen(true);
  }
  function addNote(color, mode) {
    pushHistory();
    const id = nextId.current++;
    const now = Date.now();
    setNotes((prev) => [{ id, title: '', body: '', mode: mode || 'note', checklist: [], pinned: false, hidden: false, tags: [], voiceNotes: [], color: color || customColors[0]?.id, createdAt: now, updatedAt: now }, ...prev]);
    setEditingId(id);
    setNewNoteSetupOpen(false);
    requestAnimationFrame(() => titleRefs.current[id]?.focus());
  }

  function copySharedNoteToMine(cloudNote) {
    pushHistory();
    const id = nextId.current++;
    const now = Date.now();
    setNotes((prev) => [{
      id,
      title: cloudNote.title || '',
      body: cloudNote.body || '',
      mode: cloudNote.mode || 'note',
      checklist: cloudNote.checklist || [],
      pinned: false,
      hidden: false,
      tags: cloudNote.tags || [],
      voiceNotes: cloudNote.voice_notes || [],
      color: cloudNote.color || customColors[0]?.id,
      createdAt: now,
      updatedAt: now,
    }, ...prev]);
    setConnectedNotesOpen(false);
  }

  function updateNote(id, patch) { setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n))); }
  function startEditing(note) {
    pushHistory();
    setEditingId(note.id);
    setPreEditSnapshot({ id: note.id, title: note.title, body: note.body, checklist: note.checklist, color: note.color, mode: note.mode });
    setNoteMenuOpen(false); setColorPickerOpen(false); setMenuShareInfo(false); setMenuReminderExpanded(false); setPendingClose(false); setTitleFocused(false);
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
    } else if (noteChangedSincePreEdit()) {
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
  function setNoteColor(note, colorId) { pushHistory(); updateNote(note.id, { color: colorId }); setColorPickerOpen(false); }
  function toggleNoteMode(note) { pushHistory(); const order = ['note', 'list', 'both']; setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, mode: order[(order.indexOf(n.mode || 'note') + 1) % order.length], updatedAt: Date.now() } : n))); }
  function togglePin(note) { pushHistory(); updateNote(note.id, { pinned: !note.pinned }); setNoteMenuOpen(false); }
  function toDatetimeLocal(ts) {
    const d = new Date(ts - new Date().getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  }
  function formatReminder(ts) {
    return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function setNoteReminder(note, ts) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
    pushHistory();
    updateNote(note.id, { reminderAt: ts, reminderNotified: false });
  }
  function clearNoteReminder(note) { pushHistory(); updateNote(note.id, { reminderAt: null, reminderNotified: false }); }
  function addVoiceNote(note, clip) { pushHistory(); updateNote(note.id, { voiceNotes: [...(note.voiceNotes || []), clip] }); }
  function deleteVoiceNote(note, clipId) { pushHistory(); updateNote(note.id, { voiceNotes: (note.voiceNotes || []).filter((c) => c.id !== clipId) }); }
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
  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }
  function safeFileName(title) { return (title || 'note').replace(/[^a-z0-9-_ ]/gi, '').trim() || 'note'; }
  function exportNoteAsText(note) {
    const lines = [note.title || 'Untitled', ''];
    if (note.body) lines.push(previewText(note.body).split('. ').join('.\n'), '');
    if (note.checklist && note.checklist.length) {
      note.checklist.forEach((it) => lines.push(`[${it.checked ? 'x' : ' '}] ${it.text}`));
    }
    downloadBlob(lines.join('\n'), `${safeFileName(note.title)}.txt`, 'text/plain');
    setNoteMenuOpen(false);
  }
  function noteToMarkdown(note) {
    const lines = [`# ${note.title || 'Untitled'}`, ''];
    if (note.body) lines.push(note.body, '');
    if (note.checklist && note.checklist.length) {
      note.checklist.forEach((it) => lines.push(`- [${it.checked ? 'x' : ' '}] ${it.text}`));
      lines.push('');
    }
    if (note.tags && note.tags.length) lines.push(note.tags.map((t) => `#${t}`).join(' '));
    return lines.join('\n').trim() + '\n';
  }
  function exportNoteAsMarkdown(note) {
    downloadBlob(noteToMarkdown(note), `${safeFileName(note.title)}.md`, 'text/markdown');
    setNoteMenuOpen(false);
  }
  function exportAllAsMarkdown() {
    const content = liveNotes.map(noteToMarkdown).join('\n---\n\n');
    downloadBlob(content, `notes-export-${new Date().toISOString().slice(0, 10)}.md`, 'text/markdown');
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
    const note = notes.find((n) => n.id === id);
    if (note?.cloudId) deleteCloudNote(note.cloudId);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }
  function emptyTrash() {
    if (trashedNotes.length === 0) return;
    if (!window.confirm(`Permanently delete all ${trashedNotes.length} note(s) in Trash?`)) return;
    pushHistory();
    trashedNotes.forEach((n) => { if (n.cloudId) deleteCloudNote(n.cloudId); });
    setNotes((prev) => prev.filter((n) => !n.deletedAt));
  }

  function exportAll() {
    const payload = { version: 9, notes, customColors, customThemes, settings: { activeThemeId, modalTint, view, sortBy, noteSizeIdx, textSizeIdx, defaultColor, confirmDelete, autoSave, autoMoveCompleted, similarThreshold } };
    downloadBlob(JSON.stringify(payload, null, 2), `notes-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  }
  function triggerImport() { fileInputRef.current?.click(); }
  function triggerBgImageUpload() { bgImageInputRef.current?.click(); }
  function handleBgImageFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setMainBgImage(reader.result); setMainBgEffect('image'); };
    reader.readAsDataURL(file);
    e.target.value = '';
  }
  function triggerAmbientSoundUpload() { ambientSoundInputRef.current?.click(); }
  function handleAmbientSoundFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setAmbientSoundData(reader.result); setAmbientSoundName(file.name); setAmbientSound('upload'); };
    reader.readAsDataURL(file);
    e.target.value = '';
  }
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
          reminderAt: typeof n.reminderAt === 'number' ? n.reminderAt : null,
          reminderNotified: !!n.reminderNotified,
          voiceNotes: Array.isArray(n.voiceNotes) ? n.voiceNotes : [],
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

  function saveCustomColor() {
    if (customColors.length >= MAX_CUSTOM) return;
    const [r, g, b] = hslToRgb(wheelHue, wheelSat, wheelLight);
    setCustomColors((prev) => [...prev, { id: `c${nextColorId.current++}`, hex: rgbToHex(r, g, b), label: `Color ${prev.length + 1}` }]);
  }
  function deleteCustomColor(id) { if (customColors.length <= 1) return; setCustomColors((prev) => prev.filter((c) => c.id !== id)); }
  function renameCustomColor(id, label) { setCustomColors((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c))); }
  function deleteSeparatorColor(id) {
    if (separatorColors.length <= 1) return;
    setSeparatorColors((prev) => prev.filter((c) => c.id !== id));
    if (separatorColorId === id) setSeparatorColorId('none');
  }
  function renameSeparatorColor(id, label) { setSeparatorColors((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c))); }
  function separatorColorHexOf(colorId) { return separatorColors.find((c) => c.id === colorId)?.hex || separatorColors[0]?.hex || '#5B9BB8'; }

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
            <button onClick={() => setMenuReminderExpanded((v) => !v)} style={rowStyle}>
              <Bell size={15} /> {note.reminderAt ? `Reminder: ${formatReminder(note.reminderAt)}` : 'Set reminder'}
            </button>
            {menuReminderExpanded && (
              <div style={{ padding: '4px 12px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  type="datetime-local"
                  defaultValue={note.reminderAt ? toDatetimeLocal(note.reminderAt) : ''}
                  onChange={(e) => { if (e.target.value) setNoteReminder(note, new Date(e.target.value).getTime()); }}
                  style={{ background: bg, color: text, border: borderStyle, borderRadius: 8, padding: '6px 8px', fontSize: 12, outline: 'none', colorScheme: dark ? 'dark' : 'light' }}
                />
                {note.reminderAt && (
                  <button onClick={() => { clearNoteReminder(note); setMenuReminderExpanded(false); }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: muted, cursor: 'pointer', padding: 0, fontSize: 12 }}>
                    <BellOff size={12} /> Clear reminder
                  </button>
                )}
              </div>
            )}
          </div>

          <button onClick={() => exportNoteAsText(note)} style={rowStyle}><FileText size={15} /> Export as text (.txt)</button>
          <button onClick={() => exportNoteAsMarkdown(note)} style={rowStyle}><FileText size={15} /> Export as Markdown (.md)</button>

          <button onClick={() => { setSimilarOpen(true); setNoteMenuOpen(false); }} style={rowStyle}><GitCompare size={15} /> Similar notes</button>

          <button onClick={() => setMenuShareInfo((v) => !v)} style={rowStyle}><Share2 size={15} /> Share</button>
          {menuShareInfo && <ShareNotePicker note={note} syncUser={syncUser} text={text} muted={muted} />}

          <button onClick={() => moveToTrash(note.id)} style={{ ...rowStyle, color: '#E8735F' }}><Trash2 size={15} /> Delete</button>
        </div>
      </>
    );
  }

  function ColorPickerButton(note, iconColor) {
    return (
      <div style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
        <button onClick={() => setColorPickerOpen((v) => !v)} aria-label="Note color" title="Note color" style={{ background: 'none', border: 'none', color: iconColor, cursor: 'pointer', display: 'flex', padding: 4 }}>
          <Paintbrush size={17} />
        </button>
        {colorPickerOpen && (
          <>
            <div onClick={() => setColorPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
            <div style={{ position: 'absolute', top: '100%', left: 0, display: 'flex', flexWrap: 'wrap', gap: 6, width: 150, background: elevated, border: borderStyle, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', padding: 8, zIndex: 2 }}>
              {customColors.map((c) => (
                <button key={c.id} onClick={() => setNoteColor(note, c.id)} title={c.label} style={{ width: 22, height: 22, borderRadius: 7, background: c.hex, border: c.id === note.color ? `2px solid ${text}` : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
          </>
        )}
      </div>
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
          <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', borderBottom: `1px solid ${colorHex}80` }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${colorHex}80` }}>
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

        <VoiceNotes
          clips={note.voiceNotes || []}
          onAdd={(clip) => addVoiceNote(note, clip)}
          onDelete={(clipId) => deleteVoiceNote(note, clipId)}
          accent={colorHex}
          text={noteText}
          muted={noteMuted}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 8, gap: 10, flexShrink: 0 }}>
          <button onMouseDown={(e) => e.preventDefault()} onClick={undo} disabled={past.length === 0} aria-label="Undo" title="Undo" style={{ background: 'none', border: 'none', color: past.length === 0 ? `${noteText}50` : noteText, cursor: past.length === 0 ? 'default' : 'pointer', display: 'flex', padding: 2 }}>
            <Undo2 size={17} />
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={redo} disabled={future.length === 0} aria-label="Redo" title="Redo" style={{ background: 'none', border: 'none', color: future.length === 0 ? `${noteText}50` : noteText, cursor: future.length === 0 ? 'default' : 'pointer', display: 'flex', padding: 2 }}>
            <Redo2 size={17} />
          </button>
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
            {ColorPickerButton(note, headerText)}
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

    const panelTint = mixColors(colorHex, '#000000', modalTint / 100);
    const panelText = contrastText(panelTint);
    const panelAlphaHex = Math.round((modalTint / 100) * 255).toString(16).padStart(2, '0');
    const panelBg = `${colorHex}${panelAlphaHex}`;
    return (
      <div onClick={() => requestClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 60 }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 560, height: '86vh', borderRadius: 18, overflow: 'hidden',
            background: panelBg, border: `1px solid ${colorHex}70`,
            color: panelText, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', position: 'relative',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ padding: `${s(18)}px ${s(20)}px 0`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <button onClick={() => requestClose()} aria-label="Back" title="Back" style={{ background: 'none', border: 'none', color: panelText, cursor: 'pointer', display: 'flex', padding: 4, marginLeft: -4, flexShrink: 0 }}>
                <ArrowLeft size={20} />
              </button>
              <input
                ref={(el) => (titleRefs.current[note.id] = el)}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => titleKeyDown(e, note)}
                placeholder="Title"
                spellCheck={true}
                autoFocus
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontFamily: titleFont, fontWeight: 500, fontSize: fz(18), color: panelText, padding: 0 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative', flexShrink: 0 }}>
                {note.pinned && <Pin size={15} style={{ color: panelText, opacity: 0.7 }} />}
                {ColorPickerButton(note, panelText)}
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
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: `0 ${s(20)}px` }}>
            {EditorBody(note, colorHex, panelTint)}
          </div>
          {TagFooter(note, panelTint)}
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
    <div style={{ minHeight: '100vh', background: bg, color: text, fontFamily: bodyFont, transition: 'background 0.3s, color 0.3s', position: 'relative', overflow: 'hidden' }}>
      <MainBackdrop effect={mainBgEffect} image={mainBgImage} particleColor={contrastText(bg)} />
      <AmbientAudio enabled={ambientSound === 'upload' && !!ambientSoundData} dataUrl={ambientSoundData} volume={ambientVolume} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;1,9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .note-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .note-card:hover { transform: translateY(-2px) rotate(-0.3deg); }
        .note-row:hover { filter: brightness(1.08); }
        textarea, input, select { font-family: inherit; }
        ::selection { background: #E8735F55; }
        ::placeholder { color: ${muted}; opacity: 1; }

        input[type=range] { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; background: ${borderColor}; outline: none; cursor: pointer; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #E8735F; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.35); cursor: pointer; }
        input[type=range]::-moz-range-track { height: 6px; border-radius: 999px; background: ${borderColor}; }
        input[type=range]::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #E8735F; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.35); cursor: pointer; }

        input[type=checkbox] { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; flex-shrink: 0; border-radius: 5px; border: 1.5px solid ${muted}; background: transparent; cursor: pointer; position: relative; transition: background 0.15s ease, border-color 0.15s ease; }
        input[type=checkbox]:checked { background: #E8735F; border-color: #E8735F; }
        input[type=checkbox]:checked::after { content: ''; position: absolute; left: 5px; top: 1px; width: 5px; height: 9px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: `32px 24px ${allTags.length > 0 ? 184 : 120}px`, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 34, margin: 0, letterSpacing: '-0.01em' }}>Makinote</h1>
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

            <div style={{ display: 'flex', border: borderStyle, borderRadius: 10, overflow: 'hidden' }}>
              <button onClick={() => setFullScreenEditor(false)} aria-label="Popup note editor" title="Popup note editor" style={{ width: 36, height: 36, border: 'none', cursor: 'pointer', background: !fullScreenEditor ? borderColor : elevated, color: text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Square size={16} /></button>
              <button onClick={() => setFullScreenEditor(true)} aria-label="Fullscreen note editor" title="Fullscreen note editor" style={{ width: 36, height: 36, border: 'none', cursor: 'pointer', background: fullScreenEditor ? borderColor : elevated, color: text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Maximize2 size={16} /></button>
            </div>

            <button onClick={() => setSimilarOpen(true)} aria-label="Find similar notes" title="Find similar notes" style={toolbarBtnStyle(false)}>
              <GitCompare size={16} />
              {similarPairs.length > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#E8735F', color: '#fff', borderRadius: 999, fontSize: 9, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{similarPairs.length}</span>}
            </button>
            {syncUser && (
              <button onClick={() => setConnectedNotesOpen(true)} aria-label="Connected notes" title="Connected notes" style={toolbarBtnStyle(false)}>
                <Users size={16} />
              </button>
            )}
            {pinEnabled && <button onClick={() => setLocked(true)} aria-label="Lock now" title="Lock now" style={toolbarBtnStyle(false)}><Lock size={16} /></button>}
            <button onClick={() => setSettingsOpen(true)} aria-label="Settings" title={syncUser ? `Settings — signed in as ${syncUser.email}` : 'Settings'} style={toolbarBtnStyle(false)}>
              <Settings size={16} />
              {syncUser && <span style={{ position: 'absolute', bottom: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#7FA671', border: `1.5px solid ${elevated}` }} />}
            </button>
          </div>
        </div>

        {filtered.length === 0 && (
          <div style={{ color: muted, fontSize: 14, padding: '40px 0', textAlign: 'center' }}>{query ? `Nothing matches "${query}"` : 'No notes yet — tap + to start one'}</div>
        )}

        {view === 'grid' ? (
          <div style={{ columns: `${s(220)}px`, columnGap: 16 }}>
            {filtered.map((note) => {
              const colorHex = colorHexOf(note.color);
              const noteText = text;
              return (
                <div
                  key={note.id}
                  className="note-card"
                  style={{
                    breakInside: 'avoid', marginBottom: 16, borderRadius: 14, overflow: 'hidden', display: 'flex',
                    background: elevated, border: borderStyle,
                    boxShadow: dark ? '0 1px 2px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.06)', cursor: 'pointer', position: 'relative', color: noteText,
                  }}
                  onClick={() => startEditing(note)}
                >
                  <div style={{ width: 5, flexShrink: 0, background: colorHex }} />
                  <div style={{ flex: 1, minWidth: 0, padding: `${s(16)}px ${s(16)}px ${s(12)}px` }}>
                    {note.pinned && <Pin size={13} style={{ position: 'absolute', top: 10, right: 10, opacity: 0.6, color: noteText }} />}
                    <div style={{ fontFamily: titleFont, fontWeight: 500, fontSize: fz(17), marginBottom: 4, paddingRight: note.pinned ? 16 : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title || <span style={{ color: `${noteText}80` }}>Untitled</span>}</div>
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
                    {note.reminderAt && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: fz(11), color: note.reminderAt <= Date.now() ? '#E8735F' : `${noteText}90` }}>
                        <Bell size={11} /> {formatReminder(note.reminderAt)}
                      </div>
                    )}
                    {(note.voiceNotes?.length > 0 || (note.tags && note.tags.length > 0)) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {note.voiceNotes?.length > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: fz(11), color: `${noteText}90`, background: `${noteText}18`, borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>
                            <Mic size={10} /> voice note
                          </span>
                        )}
                        {note.tags?.slice(0, 2).map((tag) => (
                          <button
                            key={tag}
                            onClick={(e) => { e.stopPropagation(); setSelectedTagFilters([tag]); }}
                            style={{ fontSize: fz(11), color: `${noteText}90`, background: `${noteText}18`, border: 'none', borderRadius: 999, padding: '2px 7px', flexShrink: 0, cursor: 'pointer' }}
                          >
                            #{tag}
                          </button>
                        ))}
                        {note.tags?.length > 2 && <span style={{ fontSize: fz(12), color: `${noteText}99`, flexShrink: 0 }}>…</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ borderRadius: 12, overflow: 'hidden', border: borderStyle }}>
            {filtered.map((note, idx) => {
              const colorHex = colorHexOf(note.color);
              const noteText = text;
              const sepHex = separatorColorId !== 'none' ? separatorColorHexOf(separatorColorId) : null;
              return (
                <div key={note.id} className="note-row" style={{ display: 'flex', borderTop: idx === 0 ? 'none' : (sepHex ? `2px solid ${sepHex}` : borderStyle), background: elevated, cursor: 'pointer', color: noteText }} onClick={() => startEditing(note)}>
                  <div style={{ width: 4, flexShrink: 0, background: colorHex }} />
                  <div style={{ flex: 1, minWidth: 0, padding: `${s(14)}px ${s(16)}px` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: titleFont, fontWeight: 500, fontSize: fz(17), display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {note.pinned && <Pin size={13} style={{ opacity: 0.6, flexShrink: 0 }} />}
                        {note.title || <span style={{ color: `${noteText}80` }}>Untitled</span>}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, maxWidth: '50%' }}>
                        {note.reminderAt && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: fz(11), color: note.reminderAt <= Date.now() ? '#E8735F' : `${noteText}90`, flexShrink: 0 }}>
                            <Bell size={11} /> {formatReminder(note.reminderAt)}
                          </span>
                        )}
                        {(note.voiceNotes?.length > 0 || (note.tags && note.tags.length > 0)) && (
                          <div style={{ display: 'flex', gap: 5, overflow: 'hidden', whiteSpace: 'nowrap', minWidth: 0 }}>
                            {note.voiceNotes?.length > 0 && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: fz(11), color: `${noteText}90`, background: `${noteText}18`, borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>
                                <Mic size={10} /> voice note
                              </span>
                            )}
                            {note.tags?.slice(0, 2).map((tag) => (
                              <button
                                key={tag}
                                onClick={(e) => { e.stopPropagation(); setSelectedTagFilters([tag]); }}
                                style={{ fontSize: fz(11), color: `${noteText}90`, background: `${noteText}18`, border: 'none', borderRadius: 999, padding: '2px 7px', flexShrink: 0, cursor: 'pointer' }}
                              >
                                #{tag}
                              </button>
                            ))}
                            {note.tags?.length > 2 && <span style={{ fontSize: fz(12), color: `${noteText}99`, flexShrink: 0 }}>…</span>}
                          </div>
                        )}
                        <span style={{ fontSize: fz(12), color: `${noteText}99`, whiteSpace: 'nowrap', flexShrink: 0 }}>{formatDate(note.updatedAt)}</span>
                      </div>
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={openNewNoteSetup} aria-label="Add note" style={{ position: 'fixed', bottom: allTags.length > 0 ? 92 : 28, right: 28, width: 56, height: 56, borderRadius: '50%', background: '#E8735F', color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(232,115,95,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
        <Plus size={24} />
      </button>

      {allTags.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 64, background: elevated, borderTop: borderStyle, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', overflowX: 'auto', zIndex: 9 }}>
          {selectedTagFilters.length > 0 && (
            <button onClick={() => setSelectedTagFilters([])} aria-label="Clear keyword filters" title="Clear keyword filters" style={{ flexShrink: 0, background: 'none', border: borderStyle, borderRadius: 999, padding: '6px 10px', fontSize: 12, color: muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={12} /> Clear
            </button>
          )}
          {selectedTagFilters.length > 1 && (
            <button
              onClick={() => setTagFilterMode((m) => (m === 'all' ? 'any' : 'all'))}
              aria-label="Toggle match all/any keywords"
              title={tagFilterMode === 'all' ? 'Matching notes with ALL selected keywords' : 'Matching notes with ANY selected keyword'}
              style={{ flexShrink: 0, background: 'none', border: borderStyle, borderRadius: 999, padding: '6px 10px', fontSize: 12, color: muted, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Match: {tagFilterMode === 'all' ? 'All' : 'Any'}
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
      <input ref={bgImageInputRef} type="file" accept="image/*" onChange={handleBgImageFile} style={{ display: 'none' }} />
      <input ref={ambientSoundInputRef} type="file" accept="audio/*" onChange={handleAmbientSoundFile} style={{ display: 'none' }} />

      {NoteEditorModal()}

      {settingsOpen && (
        <div onClick={() => { setSettingsOpen(false); setSettingsSection(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, maxHeight: '88vh', overflowY: 'auto', overscrollBehavior: 'contain', background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {settingsSection && (
                  <button onClick={() => setSettingsSection(null)} aria-label="Back to settings" title="Back to settings" style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', display: 'flex', padding: 0 }}>
                    <ArrowLeft size={18} />
                  </button>
                )}
                <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 22, margin: 0 }}>
                  {settingsSection === 'colors' ? 'Colors' : settingsSection === 'text' ? 'Text' : settingsSection === 'other' ? 'Other' : settingsSection === 'account' ? 'Account' : 'Settings'}
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
                <button onClick={() => setSettingsSection('account')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '12px 14px', fontSize: 15, cursor: 'pointer' }}>
                  <User size={17} /> <span style={{ flex: 1, textAlign: 'left' }}>Account</span> <ChevronRight size={16} style={{ color: muted }} />
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
                        <div style={{ width: 20, height: 20, borderRadius: 6, background: c.hex, flexShrink: 0 }} />
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
                    <button onClick={() => setDefaultColor('random')} title="Random" style={{ width: 30, height: 30, borderRadius: 9, cursor: 'pointer', background: 'conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red)', border: defaultColor === 'random' ? `2px solid ${text}` : '2px solid transparent' }} />
                    {customColors.map((c) => (
                      <button key={c.id} onClick={() => setDefaultColor(c.id)} title={c.label} style={{ width: 30, height: 30, borderRadius: 9, background: c.hex, cursor: 'pointer', border: defaultColor === c.id ? `2px solid ${text}` : '2px solid transparent' }} />
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 4 }}>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>List separator color</label>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 12 }}>
                    <ColorWheel size={110} hue={sepWheelHue} sat={sepWheelSat} onChange={(h, sat) => { setSepWheelHue(h); setSepWheelSat(sat); }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 120 }}>
                      <label style={{ fontSize: 11, color: muted }}>Lightness</label>
                      <LightnessSlider hue={sepWheelHue} sat={sepWheelSat} value={sepWheelLight} onChange={setSepWheelLight} />
                      <button
                        onClick={() => {
                          if (separatorColors.length >= MAX_CUSTOM) return;
                          const [r, g, b] = hslToRgb(sepWheelHue, sepWheelSat, sepWheelLight);
                          const hex = rgbToHex(r, g, b);
                          const id = `s${nextSepColorId.current++}`;
                          setSeparatorColors((prev) => [...prev, { id, hex, label: `Divider ${prev.length + 1}` }]);
                          setSeparatorColorId(id);
                        }}
                        disabled={separatorColors.length >= MAX_CUSTOM}
                        style={{ padding: '7px 10px', borderRadius: 8, border: 'none', background: '#E8735F', color: '#fff', fontSize: 12, cursor: separatorColors.length >= MAX_CUSTOM ? 'default' : 'pointer', opacity: separatorColors.length >= MAX_CUSTOM ? 0.5 : 1 }}
                      >
                        Save & use for dividers
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <button onClick={() => setSeparatorColorId('none')} title="None" style={{ width: 30, height: 30, borderRadius: 9, cursor: 'pointer', background: 'transparent', border: separatorColorId === 'none' ? `2px solid ${text}` : borderStyle }} />
                    {separatorColors.map((c) => (
                      <button key={c.id} onClick={() => setSeparatorColorId(c.id)} title={c.label} style={{ width: 30, height: 30, borderRadius: 9, background: c.hex, cursor: 'pointer', border: separatorColorId === c.id ? `2px solid ${text}` : '2px solid transparent' }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {separatorColors.map((c) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, background: c.hex, flexShrink: 0 }} />
                        <input value={c.label} onChange={(e) => renameSeparatorColor(c.id, e.target.value)} style={{ flex: 1, background: bg, border: borderStyle, borderRadius: 8, padding: '5px 8px', fontSize: 12, color: text, outline: 'none' }} />
                        {separatorColors.length > 1 && (
                          <button onClick={() => deleteSeparatorColor(c.id)} aria-label="Delete color" title="Delete color" style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex', padding: 2 }}><X size={13} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: muted, margin: '8px 0 0' }}>Only shown in list view — grid view doesn't use a separator. This is its own palette, independent from your note colors above.</p>
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
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 6 }}>Enlarged note transparency: {modalTint}%</label>
                  <input type="range" min={5} max={100} value={modalTint} onChange={(e) => setModalTint(Number(e.target.value))} style={{ width: '100%', ...rangeAccentStyle }} />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 6 }}>Similar-notes sensitivity: {Math.round(similarThreshold * 100)}% shared words</label>
                  <input type="range" min={5} max={50} value={Math.round(similarThreshold * 100)} onChange={(e) => setSimilarThreshold(Number(e.target.value) / 100)} style={{ width: '100%', ...rangeAccentStyle }} />
                </div>

                <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: borderStyle }}>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>Main menu background</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button onClick={() => setMainBgEffect('color')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: mainBgEffect === 'color' ? '2px solid #E8735F' : borderStyle, background: bg, color: text, fontSize: 13, cursor: 'pointer' }}>
                      <Ban size={14} /> None
                    </button>
                    <button onClick={() => setMainBgEffect('rain')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: mainBgEffect === 'rain' ? '2px solid #E8735F' : borderStyle, background: bg, color: text, fontSize: 13, cursor: 'pointer' }}>
                      <CloudRain size={14} /> Rain
                    </button>
                    <button onClick={() => setMainBgEffect('stars')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: mainBgEffect === 'stars' ? '2px solid #E8735F' : borderStyle, background: bg, color: text, fontSize: 13, cursor: 'pointer' }}>
                      <Sparkles size={14} /> Space
                    </button>
                    <button onClick={() => (mainBgImage ? setMainBgEffect('image') : triggerBgImageUpload())} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: mainBgEffect === 'image' ? '2px solid #E8735F' : borderStyle, background: bg, color: text, fontSize: 13, cursor: 'pointer' }}>
                      <ImageIcon size={14} /> Image
                    </button>
                  </div>
                  {mainBgEffect === 'image' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                      {mainBgImage && <img src={mainBgImage} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: borderStyle }} />}
                      <button onClick={triggerBgImageUpload} style={{ padding: '7px 10px', borderRadius: 8, border: borderStyle, background: bg, color: text, fontSize: 12, cursor: 'pointer' }}>
                        {mainBgImage ? 'Change image' : 'Upload image'}
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: borderStyle }}>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>Ambient sound (loops while the app is open)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button onClick={() => setAmbientSound('none')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: ambientSound === 'none' ? '2px solid #E8735F' : borderStyle, background: bg, color: text, fontSize: 13, cursor: 'pointer' }}>
                      <Ban size={14} /> None
                    </button>
                    <button onClick={() => (ambientSoundData ? setAmbientSound('upload') : triggerAmbientSoundUpload())} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: ambientSound === 'upload' ? '2px solid #E8735F' : borderStyle, background: bg, color: text, fontSize: 13, cursor: 'pointer' }}>
                      <Music size={14} /> Sound
                    </button>
                  </div>
                  {ambientSound === 'upload' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                        {ambientSoundName && <span style={{ fontSize: 12, color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{ambientSoundName}</span>}
                        <button onClick={triggerAmbientSoundUpload} style={{ padding: '7px 10px', borderRadius: 8, border: borderStyle, background: bg, color: text, fontSize: 12, cursor: 'pointer' }}>
                          {ambientSoundData ? 'Change sound' : 'Upload sound'}
                        </button>
                      </div>
                      <label style={{ fontSize: 11, color: muted, display: 'block', margin: '10px 0 4px' }}>Volume: {Math.round(ambientVolume * 100)}%</label>
                      <input type="range" min={0} max={100} value={Math.round(ambientVolume * 100)} onChange={(e) => setAmbientVolume(Number(e.target.value) / 100)} style={{ width: '100%', ...rangeAccentStyle }} />
                    </>
                  )}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={autoMoveCompleted} onChange={(e) => setAutoMoveCompleted(e.target.checked)} />
                  Auto-move crossed-out text to the bottom (checklist items always do this)
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
                  <button onClick={openHiddenNotes} style={{ display: 'flex', alignItems: 'center', gap: 8, background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '9px 12px', fontSize: 14, cursor: 'pointer', width: '100%' }}>
                    <EyeOff size={15} /> Hidden notes{hiddenNotes.length > 0 ? ` (${hiddenNotes.length})` : ''}{pinEnabled ? ' — PIN required' : ''}
                  </button>
                  <button onClick={() => setTrashOpen(true)} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '9px 12px', fontSize: 14, cursor: 'pointer', width: '100%' }}>
                    <Archive size={15} /> Trash{trashedNotes.length > 0 ? ` (${trashedNotes.length})` : ''}
                  </button>
                </div>

                <div style={{ borderTop: borderStyle, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 13, color: muted, marginBottom: -2 }}>Backup (notes, colors, settings)</label>
                  <button onClick={exportAll} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '10px 12px', fontSize: 14, cursor: 'pointer' }}><Download size={15} /> Export backup (.json)</button>
                  <button onClick={exportAllAsMarkdown} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '10px 12px', fontSize: 14, cursor: 'pointer' }}><FileText size={15} /> Export all notes (.md)</button>
                  <button onClick={triggerImport} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '10px 12px', fontSize: 14, cursor: 'pointer' }}><Upload size={15} /> Import backup (.json)</button>
                  <p style={{ fontSize: 12, color: muted, margin: '4px 0 0' }}>Importing replaces all current notes — export first if you want a copy of what's there now.</p>
                </div>
              </>
            )}

            {settingsSection === 'account' && (
              <>
                <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: borderStyle }}>
                  <AccountPanel onUserChange={setSyncUser} syncStatus={syncStatus} text={text} muted={muted} bg={bg} borderStyle={borderStyle} />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 20, cursor: 'pointer', paddingBottom: 18, borderBottom: borderStyle }}>
                  <input type="checkbox" checked={shareColors} onChange={(e) => setShareColors(e.target.checked)} />
                  Shared colors — sync my colors &amp; themes across my signed-in devices
                </label>

                <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: borderStyle }}>
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
                  <p style={{ fontSize: 11, color: muted, margin: '8px 0 0' }}>This locks the app screen only — it's a basic deterrent, not real encryption. It's device-specific and won't sync to your other devices.</p>
                </div>

                <div>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>Connected accounts</label>
                  <ConnectedAccounts syncUser={syncUser} text={text} muted={muted} bg={bg} borderStyle={borderStyle} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {trashOpen && (
        <div onClick={() => setTrashOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto', overscrollBehavior: 'contain', background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
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
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto', overscrollBehavior: 'contain', background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
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
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, maxHeight: '80vh', overflowY: 'auto', overscrollBehavior: 'contain', background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
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

      {connectedNotesOpen && (
        <ConnectedNotesModal
          syncUser={syncUser}
          onClose={() => setConnectedNotesOpen(false)}
          onCopy={copySharedNoteToMine}
          text={text}
          muted={muted}
          bg={bg}
          elevated={elevated}
          borderStyle={borderStyle}
        />
      )}

      {newNoteSetupOpen && (
        <div onClick={() => setNewNoteSetupOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 340, background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 20, margin: '0 0 16px' }}>New note</h2>
            <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>Color</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {customColors.map((c) => (
                <button key={c.id} onClick={() => setPendingNoteColor(c.id)} title={c.label} style={{ width: 30, height: 30, borderRadius: 9, background: c.hex, cursor: 'pointer', border: pendingNoteColor === c.id ? `2px solid ${text}` : '2px solid transparent' }} />
              ))}
            </div>
            <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>Type</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[{ v: 'note', l: 'Note' }, { v: 'list', l: 'List' }, { v: 'both', l: 'Both' }].map((opt) => (
                <button key={opt.v} onClick={() => setPendingNoteMode(opt.v)} style={{ flex: 1, padding: '9px 8px', borderRadius: 10, border: pendingNoteMode === opt.v ? '2px solid #E8735F' : borderStyle, background: bg, color: text, fontSize: 13, cursor: 'pointer' }}>{opt.l}</button>
              ))}
            </div>
            <button onClick={() => addNote(pendingNoteColor, pendingNoteMode)} style={{ width: '100%', background: '#E8735F', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 14, cursor: 'pointer' }}>Create note</button>
          </div>
        </div>
      )}
    </div>
  );
}
