import { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
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
  APP_VERSION, FONT_OPTIONS, STARTER_COLORS, STARTER_THEMES, SEED_NOTES, SORT_OPTIONS, SIZE_STEPS, SCALE_MAP,
  NOTES_KEY, SETTINGS_KEY, LEGACY_NOTES_KEY, LEGACY_SETTINGS_KEY, MAX_HISTORY, MAX_CUSTOM,
} from './constants';
import ColorWheel from './components/ColorWheel';
import LightnessSlider from './components/LightnessSlider';
import Checkbox from './components/Checkbox';
import MainBackdrop from './components/MainBackdrop';
import VoiceNotes from './components/VoiceNotes';
import NoteImages from './components/NoteImages';
import AccountPanel from './components/AccountPanel';
import ConnectedAccounts from './components/ConnectedAccounts';
import ShareNotePicker from './components/ShareNotePicker';
import ConnectedNotesModal from './components/ConnectedNotesModal';
import AmbientAudio from './components/AmbientAudio';
import { useNotesSync } from './hooks/useNotesSync';
import { useSettingsSync } from './hooks/useSettingsSync';
import { supabase, supabaseEnabled } from './lib/supabaseClient';

const VOICE_TAG = '__voice__';
const IMAGE_TAG = '__image__';
const PIN_LOCKOUT_KEY = 'makinote_pin_lockout_v1';
const LOCKOUT_SCHEDULE = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];
function lockoutDurationFor(failCount) {
  const idx = failCount - 5;
  if (idx < 0) return 0;
  return LOCKOUT_SCHEDULE[Math.min(idx, LOCKOUT_SCHEDULE.length - 1)];
}
function formatDuration(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'less than a minute';
  if (mins === 1) return '1 minute';
  if (mins < 60) return `${mins} minutes`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? '1 hour' : `${hrs} hours`;
}

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
  const [modalTint, setModalTint] = useState(50);
  const [transparentCards, setTransparentCards] = useState(false);
  const [separatorColorId, setSeparatorColorId] = useState('none');
  const [titleFocused, setTitleFocused] = useState(false);
  const [mainBgEffect, setMainBgEffect] = useState('color');
  const [mainBgImage, setMainBgImage] = useState(null);
  const [syncUser, setSyncUser] = useState(null);
  const [acceptsConnections, setAcceptsConnectionsState] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError, setSyncError] = useState('');
  const [pendingShareTarget, setPendingShareTarget] = useState(null);
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
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [has2FA, setHas2FA] = useState(false);
  const [pinMfaMode, setPinMfaMode] = useState(false);
  const [pinMfaCode, setPinMfaCode] = useState('');
  const [pinMfaError, setPinMfaError] = useState('');
  const [accountRecoveryFocus, setAccountRecoveryFocus] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [similarOpen, setSimilarOpen] = useState(false);
  const [similarFocusId, setSimilarFocusId] = useState(null);
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
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);
  const [bulkColorPickerOpen, setBulkColorPickerOpen] = useState(false);
  const [bulkSharePickerOpen, setBulkSharePickerOpen] = useState(false);
  const [bulkShareConnections, setBulkShareConnections] = useState([]);
  const [bulkShareStatus, setBulkShareStatus] = useState('');
  const [tagFilterMode, setTagFilterMode] = useState('any');

  const [pinEnabled, setPinEnabled] = useState(false);
  const [pin, setPin] = useState('');
  const [locked, setLocked] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinFailCount, setPinFailCount] = useState(() => loadLocal(PIN_LOCKOUT_KEY)?.failCount || 0);
  const [pinLockUntil, setPinLockUntil] = useState(() => loadLocal(PIN_LOCKOUT_KEY)?.lockUntil || 0);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSetupError, setPinSetupError] = useState('');

  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [justSaved, setJustSaved] = useState(false);
  const [backSaveToast, setBackSaveToast] = useState(false);

  const [wheelHue, setWheelHue] = useState(200);
  const [wheelSat, setWheelSat] = useState(0.6);
  const [wheelLight, setWheelLight] = useState(0.55);
  const [sepWheelHue, setSepWheelHue] = useState(200);
  const [sepWheelSat, setSepWheelSat] = useState(0.6);
  const [sepWheelLight, setSepWheelLight] = useState(0.55);
  const [colorCreatorContext, setColorCreatorContext] = useState(null);
  const [colorToDelete, setColorToDelete] = useState(null);
  const [colorMigration, setColorMigration] = useState(null);
  const [migrationStep, setMigrationStep] = useState('ask');

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
  const longPressTimer = useRef(null);
  const editHistoryPushed = useRef(false);
  const editHistoryTimer = useRef(null);
  const voiceNotesRef = useRef(null);
  const noteImagesRef = useRef(null);
  const longPressFired = useRef(false);
  const lastPointerType = useRef('mouse');
  const noteHistoryPushed = useRef(false);
  const settingsHistoryPushed = useRef(false);
  const connectedNotesHistoryPushed = useRef(false);
  const settingsSectionHistoryPushed = useRef(false);
  const suppressBackNav = useRef(false);
  const { deleteCloudNote } = useNotesSync({ notes, setNotes, syncUser, nextIdRef: nextId, setSyncStatus, setSyncError });

  useEffect(() => {
    if (!supabaseEnabled || !syncUser) return;
    let cancelled = false;
    supabase.from('profiles').select('accepts_connections').eq('id', syncUser.id).single().then(({ data }) => {
      if (!cancelled && data) setAcceptsConnectionsState(data.accepts_connections);
    });
    return () => { cancelled = true; };
  }, [syncUser]);

  async function toggleAcceptsConnections(value) {
    setAcceptsConnectionsState(value);
    if (supabaseEnabled && syncUser) await supabase.from('profiles').update({ accepts_connections: value }).eq('id', syncUser.id);
  }

  useEffect(() => {
    if (!pendingShareTarget || !syncUser || !supabaseEnabled) return;
    const note = notes.find((n) => n.id === pendingShareTarget.noteId);
    if (note?.cloudId) {
      supabase.from('note_shares').upsert(
        { note_id: note.cloudId, owner_id: syncUser.id, shared_with_id: pendingShareTarget.connectionId },
        { onConflict: 'note_id,shared_with_id' },
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the one-shot pending-share marker once its note has synced
      setPendingShareTarget(null);
    }
  }, [notes, pendingShareTarget, syncUser]);
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

  useLayoutEffect(() => {
    let savedNotes = loadLocal(NOTES_KEY);
    if (!savedNotes) {
      const legacyNotes = loadLocal(LEGACY_NOTES_KEY);
      if (legacyNotes) { savedNotes = legacyNotes; saveLocal(NOTES_KEY, legacyNotes); }
    }
    if (Array.isArray(savedNotes) && savedNotes.length) {
      let initialNotes = savedNotes.map((n) => ({ checklist: [], pinned: false, hidden: false, tags: [], mode: 'note', voiceNotes: [], images: [], ...n }));
      // Sweep out empty notes left behind by earlier sessions (nothing typed,
      // no checklist/voice/images/tags), aside from ones already in Trash.
      initialNotes = initialNotes.filter((n) => {
        if (n.deletedAt || n.remoteOwnerId) return true;
        const isEmpty = !(n.title || '').trim() && !(n.body || '').trim()
          && (!n.checklist || n.checklist.length === 0)
          && (!n.voiceNotes || n.voiceNotes.length === 0)
          && (!n.images || n.images.length === 0)
          && (!n.tags || n.tags.length === 0);
        return !isEmpty;
      });
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
    } else {
      // Fresh install, nothing in localStorage yet — the starter notes are
      // the current `notes` state, so new ids must start past their max.
      nextId.current = Math.max(4, ...SEED_NOTES.map((n) => (n.id || 0) + 1));
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
      if (typeof savedSettings.transparentCards === 'boolean') setTransparentCards(savedSettings.transparentCards);
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
    saveLocal(SETTINGS_KEY, { customColors, customThemes, activeThemeId, modalTint, transparentCards, separatorColorId, separatorColors, mainBgEffect, mainBgImage, shareColors, ambientSound, ambientSoundData, ambientSoundName, ambientVolume, view, sortBy, noteSizeIdx, textSizeIdx, defaultColor, confirmDelete, autoSave, autoMoveCompleted, fontChoice, confirmOnClose, fullScreenEditor, similarThreshold, pinEnabled, pin });
  }, [customColors, customThemes, activeThemeId, modalTint, transparentCards, separatorColorId, separatorColors, mainBgEffect, mainBgImage, shareColors, ambientSound, ambientSoundData, ambientSoundName, ambientVolume, view, sortBy, noteSizeIdx, textSizeIdx, defaultColor, confirmDelete, autoSave, autoMoveCompleted, fontChoice, confirmOnClose, fullScreenEditor, similarThreshold, pinEnabled, pin, hydrated]);

  useEffect(() => {
    saveLocal(PIN_LOCKOUT_KEY, { failCount: pinFailCount, lockUntil: pinLockUntil });
  }, [pinFailCount, pinLockUntil]);

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

  useEffect(() => {
    if (!supabaseEnabled) return;
    async function checkMfaStatus() {
      const { data } = await supabase.auth.mfa.listFactors();
      setHas2FA(!!data?.totp?.some((f) => f.status === 'verified'));
    }
    checkMfaStatus();
    // AccountPanel only mounts (and only then learns who's signed in) once
    // Settings -> Account has actually been opened. Check the session here
    // too so signed-in state (and anything that depends on it, like
    // Connected Notes) is available from the moment the app loads.
    supabase.auth.getSession().then(({ data }) => setSyncUser(data.session?.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setSyncUser(session?.user || null);
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setSettingsSection('account');
        setSettingsOpen(true);
      }
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'MFA_CHALLENGE_VERIFIED') checkMfaStatus();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.body.style.overflow = editingId && !fullScreenEditor ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [editingId, fullScreenEditor]);

  useEffect(() => {
    function onPopState() {
      suppressBackNav.current = true;
      if (settingsOpen && settingsSection) {
        settingsSectionHistoryPushed.current = false;
        setSettingsSection(null);
      } else if (settingsOpen) closeSettings();
      else if (editingId) {
        // If a text field is focused (keyboard likely open), the first back
        // press should just dismiss the keyboard — matching normal Android
        // behavior — not close the note. Re-push the entry we just popped
        // so the note stays open; the next back press actually closes it.
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && active.blur) {
          active.blur();
          window.history.pushState({ layer: 'note' }, '');
          requestAnimationFrame(() => { suppressBackNav.current = false; });
          return;
        }
        const didChange = noteChangedSincePreEdit();
        if (confirmOnClose && editingNote && didChange) {
          // Re-push the entry we just popped so app state stays consistent
          // while we ask — if they cancel, they're still "on" this note.
          window.history.pushState({ layer: 'note' }, '');
          setPendingClose(true);
        } else {
          finalizeClose(false);
          if (didChange) {
            setBackSaveToast(true);
            setTimeout(() => setBackSaveToast(false), 1500);
          }
        }
      } else if (connectedNotesOpen) {
        connectedNotesHistoryPushed.current = false;
        setConnectedNotesOpen(false);
      }
      requestAnimationFrame(() => { suppressBackNav.current = false; });
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  });

  useEffect(() => {
    if (editingId && !noteHistoryPushed.current) {
      window.history.pushState({ layer: 'note' }, '');
      noteHistoryPushed.current = true;
    } else if (!editingId) {
      noteHistoryPushed.current = false;
    }
  }, [editingId]);

  useEffect(() => {
    if (settingsOpen && !settingsHistoryPushed.current) {
      window.history.pushState({ layer: 'settings' }, '');
      settingsHistoryPushed.current = true;
    } else if (!settingsOpen) {
      settingsHistoryPushed.current = false;
    }
  }, [settingsOpen]);

  useEffect(() => {
    if (settingsSection && !settingsSectionHistoryPushed.current) {
      window.history.pushState({ layer: 'settingsSection' }, '');
      settingsSectionHistoryPushed.current = true;
    } else if (!settingsSection) {
      settingsSectionHistoryPushed.current = false;
    }
  }, [settingsSection]);

  useEffect(() => {
    if (connectedNotesOpen && !connectedNotesHistoryPushed.current) {
      window.history.pushState({ layer: 'connectedNotes' }, '');
      connectedNotesHistoryPushed.current = true;
    } else if (!connectedNotesOpen) {
      connectedNotesHistoryPushed.current = false;
    }
  }, [connectedNotesOpen]);

  const liveNotes = useMemo(() => notes.filter((n) => !n.deletedAt && !n.hidden && !n.remoteOwnerId), [notes]);
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

  function effectiveTags(n) {
    const tags = n.tags || [];
    return n.voiceNotes?.length > 0 || n.images?.length > 0
      ? [...tags, ...(n.voiceNotes?.length > 0 ? [VOICE_TAG] : []), ...(n.images?.length > 0 ? [IMAGE_TAG] : [])]
      : tags;
  }

  const allTags = useMemo(() => {
    const set = new Set();
    liveNotes.forEach((n) => effectiveTags(n).forEach((t) => set.add(t)));
    const real = [...set].filter((t) => t !== VOICE_TAG && t !== IMAGE_TAG).sort();
    return [...(set.has(VOICE_TAG) ? [VOICE_TAG] : []), ...(set.has(IMAGE_TAG) ? [IMAGE_TAG] : []), ...real];
  }, [liveNotes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = !q ? liveNotes : liveNotes.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || (n.checklist || []).some((it) => it.text.toLowerCase().includes(q)));
    if (selectedTagFilters.length > 0) {
      base = base.filter((n) => (
        tagFilterMode === 'all'
          ? selectedTagFilters.every((t) => effectiveTags(n).includes(t))
          : effectiveTags(n).some((t) => selectedTagFilters.includes(t))
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

  // Typed text lives in draftTitle/draftBody until a save commits it to the
  // `notes` array — so any snapshot of "current state" taken for undo/redo
  // must merge the live draft in, or it silently misses whatever's been
  // typed but not yet saved.
  function notesWithCurrentDraft() {
    return editingId && editingNote
      ? notes.map((n) => (n.id === editingId ? { ...n, title: draftTitle, body: draftBody } : n))
      : notes;
  }
  function pushHistory() { setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), notesWithCurrentDraft()]); setFuture([]); }
  // Typing in the title/body was never captured by pushHistory (it only
  // covers structural actions like color/pin/checklist), so Undo appeared to
  // do nothing after just typing. This captures the state once, right before
  // the first keystroke of an editing session, so Undo can revert typed
  // changes without pushing a snapshot on every single character.
  function ensureEditHistory() {
    if (!editHistoryPushed.current) {
      setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), notesWithCurrentDraft()]);
      setFuture([]);
      editHistoryPushed.current = true;
    }
    // A pause in typing "closes" this undo step, so the next change (e.g.
    // typing again, or deleting something) starts a fresh one — otherwise
    // undoing after several unrelated edits in one sitting would jump all
    // the way back to when the note was first opened instead of reverting
    // just the last thing you did, like an accidental delete.
    if (editHistoryTimer.current) clearTimeout(editHistoryTimer.current);
    editHistoryTimer.current = setTimeout(() => { editHistoryPushed.current = false; }, 1500);
  }
  function undo() {
    setPast((p) => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      // Same fix as pushHistory: the state being pushed onto `future` (so
      // Redo can come back to it) must include the live draft too, or Redo
      // later restores a snapshot missing whatever was typed just before
      // Undo — which is exactly why Redo visibly did nothing.
      setFuture((f) => [notesWithCurrentDraft(), ...f]);
      setNotes(previous);
      // The title/body sync effect only re-fires when editingNote's fields
      // actually differ from before — but if autosave hadn't committed the
      // typed text to `notes` yet, the restored snapshot can be identical
      // to current `notes`, so the effect never fires and the editor kept
      // showing the un-reverted text. Force the draft to match directly.
      if (editingId) {
        const restored = previous.find((n) => n.id === editingId);
        if (restored) { setDraftTitle(restored.title); setDraftBody(restored.body); }
      }
      return p.slice(0, -1);
    });
  }
  function redo() {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p, notesWithCurrentDraft()]);
      setNotes(next);
      if (editingId) {
        const restored = next.find((n) => n.id === editingId);
        if (restored) { setDraftTitle(restored.title); setDraftBody(restored.body); }
      }
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
      setPreEditSnapshot({ id: savedNote.id, title: savedNote.title, body: savedNote.body, checklist: savedNote.checklist, color: savedNote.color, mode: savedNote.mode, images: savedNote.images, voiceNotes: savedNote.voiceNotes });
    }
  }

  function openNewNoteSetup() {
    const color = defaultColor === 'random' ? customColors[Math.floor(Math.random() * customColors.length)]?.id : defaultColor;
    setPendingNoteColor(color || customColors[0]?.id);
    setPendingNoteMode('note');
    setNewNoteSetupOpen(true);
  }
  function openNoteColorCreator(context) {
    setColorCreatorContext(context || null);
    setColorPickerOpen(false);
    setNewNoteSetupOpen(false);
    setSettingsSection('quickNoteColor');
    setSettingsOpen(true);
  }
  function confirmNewNoteColor() {
    if (customColors.length >= MAX_CUSTOM) return;
    const [r, g, b] = hslToRgb(wheelHue, wheelSat, wheelLight);
    const id = `c${nextColorId.current++}`;
    setCustomColors((prev) => [...prev, { id, hex: rgbToHex(r, g, b), label: `Color ${prev.length + 1}` }]);
    closeSettings();
    if (colorCreatorContext?.type === 'note') {
      setNoteColor(colorCreatorContext.note, id);
    } else if (colorCreatorContext?.type === 'newNote') {
      setPendingNoteColor(id);
      setNewNoteSetupOpen(true);
    }
    setColorCreatorContext(null);
  }
  function requestDeleteColor(color) {
    if (customColors.length <= 1) return;
    setColorToDelete(color);
  }
  function confirmDeleteColor() {
    if (!colorToDelete) return;
    const deletedId = colorToDelete.id;
    const deletedLabel = colorToDelete.label;
    const affected = notes.filter((n) => n.color === deletedId && !n.deletedAt);
    deleteCustomColor(deletedId);
    setColorToDelete(null);
    if (affected.length > 0) {
      setMigrationStep('ask');
      setColorMigration({ label: deletedLabel, noteIds: affected.map((n) => n.id), noteTitles: affected.map((n) => n.title || 'Untitled note') });
    }
  }
  function confirmColorMigration() {
    if (!colorMigration) return;
    const [r, g, b] = hslToRgb(wheelHue, wheelSat, wheelLight);
    const id = `c${nextColorId.current++}`;
    setCustomColors((prev) => [...prev, { id, hex: rgbToHex(r, g, b), label: `Color ${prev.length + 1}` }]);
    setNotes((prev) => prev.map((n) => (colorMigration.noteIds.includes(n.id) ? { ...n, color: id, updatedAt: Date.now() } : n)));
    setColorMigration(null);
  }
  function addNote(color, mode, shareWithConnectionId) {
    const id = nextId.current++;
    const now = Date.now();
    const resolvedColor = color || customColors[0]?.id;
    const resolvedMode = mode || 'note';
    setNotes((prev) => [{ id, title: '', body: '', mode: resolvedMode, checklist: [], pinned: false, hidden: false, tags: [], voiceNotes: [], images: [], color: resolvedColor, createdAt: now, updatedAt: now }, ...prev]);
    setEditingId(id);
    setPreEditSnapshot({ id, title: '', body: '', checklist: [], color: resolvedColor, mode: resolvedMode, images: [], voiceNotes: [] });
    editHistoryPushed.current = false;
    setNewNoteSetupOpen(false);
    if (shareWithConnectionId) setPendingShareTarget({ noteId: id, connectionId: shareWithConnectionId });
    requestAnimationFrame(() => titleRefs.current[id]?.focus());
  }

  function createNoteForConnection(connectionId) {
    addNote(undefined, 'note', connectionId);
  }

  // Opens a note shared between me and a connection so either side can edit it.
  // If I'm the owner, it's already one of my own local notes — just open that.
  // Otherwise, inject a local "shadow" copy tagged with remoteOwnerId so the
  // editor works normally, but sync pushes updates (not inserts) and it's kept
  // out of the main note list.
  function openSharedNote(cloudNote, share) {
    const isMine = share.owner_id === syncUser?.id;
    if (isMine) {
      const existing = notes.find((n) => n.cloudId === cloudNote.id);
      if (existing) { startEditing(existing); return; }
    }
    pushHistory();
    const localId = cloudNote.id;
    const injected = {
      id: localId,
      title: cloudNote.title || '',
      body: cloudNote.body || '',
      mode: cloudNote.mode || 'note',
      checklist: cloudNote.checklist || [],
      pinned: false,
      hidden: false,
      tags: cloudNote.tags || [],
      voiceNotes: cloudNote.voice_notes || [],
      images: cloudNote.images || [],
      color: cloudNote.color || customColors[0]?.id,
      createdAt: cloudNote.created_at ? new Date(cloudNote.created_at).getTime() : Date.now(),
      updatedAt: cloudNote.updated_at ? new Date(cloudNote.updated_at).getTime() : Date.now(),
      cloudId: cloudNote.id,
      remoteOwnerId: isMine ? null : share.owner_id,
    };
    setNotes((prev) => (prev.some((n) => n.id === localId) ? prev.map((n) => (n.id === localId ? injected : n)) : [injected, ...prev]));
    setEditingId(localId);
    setPreEditSnapshot({ id: localId, title: injected.title, body: injected.body, checklist: injected.checklist, color: injected.color, mode: injected.mode, images: injected.images, voiceNotes: injected.voiceNotes });
    editHistoryPushed.current = false;
  }

  function updateNote(id, patch) { setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n))); }
  function startEditing(note) {
    setEditingId(note.id);
    setPreEditSnapshot({ id: note.id, title: note.title, body: note.body, checklist: note.checklist, color: note.color, mode: note.mode, images: note.images, voiceNotes: note.voiceNotes });
    editHistoryPushed.current = false;
    setNoteMenuOpen(false); setColorPickerOpen(false); setMenuShareInfo(false); setMenuReminderExpanded(false); setPendingClose(false); setTitleFocused(false);
  }
  function noteChangedSincePreEdit() {
    if (!preEditSnapshot || !editingNote) return false;
    return (
      draftTitle !== preEditSnapshot.title ||
      draftBody !== preEditSnapshot.body ||
      editingNote.color !== preEditSnapshot.color ||
      editingNote.mode !== preEditSnapshot.mode ||
      JSON.stringify(editingNote.checklist) !== JSON.stringify(preEditSnapshot.checklist) ||
      JSON.stringify(editingNote.images || []) !== JSON.stringify(preEditSnapshot.images || []) ||
      JSON.stringify(editingNote.voiceNotes || []) !== JSON.stringify(preEditSnapshot.voiceNotes || [])
    );
  }
  function requestClose() {
    if (confirmOnClose && editingNote && noteChangedSincePreEdit()) { setPendingClose(true); return; }
    finalizeClose(false);
  }
  function finalizeClose(discard) {
    const noteId = editingNote?.id ?? preEditSnapshot?.id;
    let finalTitle, finalBody, finalChecklist;
    if (discard && preEditSnapshot) {
      finalTitle = preEditSnapshot.title;
      finalBody = preEditSnapshot.body;
      finalChecklist = preEditSnapshot.checklist;
      updateNote(preEditSnapshot.id, { title: finalTitle, body: finalBody, checklist: finalChecklist, color: preEditSnapshot.color, mode: preEditSnapshot.mode });
    } else if (noteChangedSincePreEdit()) {
      finalTitle = draftTitle;
      finalBody = draftBody;
      finalChecklist = editingNote?.checklist;
      saveCurrentNote();
    } else {
      finalTitle = editingNote?.title;
      finalBody = editingNote?.body;
      finalChecklist = editingNote?.checklist;
    }
    const isEmpty = noteId != null
      && !(finalTitle || '').trim()
      && !(finalBody || '').trim()
      && (!finalChecklist || finalChecklist.length === 0)
      && (!editingNote?.voiceNotes || editingNote.voiceNotes.length === 0)
      && (!editingNote?.images || editingNote.images.length === 0)
      && (!editingNote?.tags || editingNote.tags.length === 0);
    if (isEmpty) {
      if (editingNote?.cloudId) deleteCloudNote(editingNote.cloudId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    }
    setEditingId(null);
    setNoteMenuOpen(false);
    setPendingClose(false);
    setPreEditSnapshot(null);
    if (noteHistoryPushed.current) {
      noteHistoryPushed.current = false;
      if (!suppressBackNav.current) window.history.back();
    }
  }
  function closeConnectedNotes() {
    setConnectedNotesOpen(false);
    if (connectedNotesHistoryPushed.current) {
      connectedNotesHistoryPushed.current = false;
      if (!suppressBackNav.current) window.history.back();
    }
  }
  function closeSettings() {
    const steps = (settingsSectionHistoryPushed.current ? 1 : 0) + (settingsHistoryPushed.current ? 1 : 0);
    setSettingsOpen(false);
    setSettingsSection(null);
    settingsSectionHistoryPushed.current = false;
    settingsHistoryPushed.current = false;
    if (steps > 0 && !suppressBackNav.current) window.history.go(-steps);
  }
  function backToSettingsHub() {
    setSettingsSection(null);
    if (settingsSectionHistoryPushed.current) {
      settingsSectionHistoryPushed.current = false;
      if (!suppressBackNav.current) window.history.back();
    }
  }
  function openHiddenNotes() {
    if (pinEnabled) { setHiddenPinCheck(true); setHiddenPinEntry(''); setHiddenPinError(''); }
    else { setHiddenOpen(true); }
  }
  function checkPin(entry, onSuccess, setErrorFn, setEntryFn) {
    if (pinLockUntil > Date.now()) {
      setErrorFn(`Too many attempts. Try again in ${formatDuration(pinLockUntil - Date.now())}.`);
      setEntryFn('');
      return;
    }
    if (entry === pin) {
      setPinFailCount(0);
      setPinLockUntil(0);
      setEntryFn('');
      setErrorFn('');
      onSuccess();
    } else {
      const nextFail = pinFailCount + 1;
      setPinFailCount(nextFail);
      setEntryFn('');
      const duration = lockoutDurationFor(nextFail);
      if (duration > 0) {
        setPinLockUntil(Date.now() + duration);
        setErrorFn(`Too many attempts. Try again in ${formatDuration(duration)}.`);
      } else {
        setErrorFn('Wrong PIN');
      }
    }
  }
  function confirmHiddenPin() {
    checkPin(hiddenPinEntry, () => { setHiddenPinCheck(false); setHiddenOpen(true); }, setHiddenPinError, setHiddenPinEntry);
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
  function renameVoiceNote(note, clipId, name) {
    ensureEditHistory();
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, voiceNotes: (n.voiceNotes || []).map((c) => (c.id === clipId ? { ...c, name } : c)), updatedAt: Date.now() } : n)));
  }
  function addImage(note, image) {
    pushHistory();
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, images: [...(n.images || []), image], updatedAt: Date.now() } : n)));
  }
  function deleteImage(note, imageId) {
    pushHistory();
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, images: (n.images || []).filter((img) => img.id !== imageId), updatedAt: Date.now() } : n)));
  }
  function renameImage(note, imageId, name) {
    ensureEditHistory();
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, images: (n.images || []).map((img) => (img.id === imageId ? { ...img, name } : img)), updatedAt: Date.now() } : n)));
  }
  function autoGrowTextarea(el) {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    // Growing the textarea can push the cursor out of view of the scrollable
    // note panel around it — nudge it back into sight after the resize.
    requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  }
  function pasteImageFromClipboard(e, note) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItem = [...items].find((it) => it.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addImage(note, { id: `img${Date.now()}${Math.random().toString(36).slice(2, 6)}`, dataUrl: reader.result });
    reader.readAsDataURL(file);
  }
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

  function toggleSelectNote(id) {
    setSelectedNoteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function clearSelection() {
    setSelectedNoteIds([]);
    setBulkColorPickerOpen(false);
  }
  function handlePressStart(note, e) {
    lastPointerType.current = e?.pointerType || 'mouse';
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      toggleSelectNote(note.id);
    }, 500);
  }
  function handlePressEnd() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }
  function handleContextMenu(e, note) {
    e.preventDefault();
    if (lastPointerType.current === 'touch') return;
    toggleSelectNote(note.id);
  }
  function handleCardClick(note) {
    if (longPressFired.current) { longPressFired.current = false; return; }
    if (selectedNoteIds.length > 0) { toggleSelectNote(note.id); return; }
    startEditing(note);
  }
  function bulkDelete() {
    if (confirmDelete && !window.confirm(`Move ${selectedNoteIds.length} note${selectedNoteIds.length === 1 ? '' : 's'} to Trash?`)) return;
    pushHistory();
    setNotes((prev) => prev.map((n) => (selectedNoteIds.includes(n.id) ? { ...n, deletedAt: Date.now() } : n)));
    clearSelection();
  }
  function bulkHide() {
    pushHistory();
    setNotes((prev) => prev.map((n) => (selectedNoteIds.includes(n.id) ? { ...n, hidden: true } : n)));
    clearSelection();
  }
  function bulkSetColor(colorId) {
    pushHistory();
    setNotes((prev) => prev.map((n) => (selectedNoteIds.includes(n.id) ? { ...n, color: colorId } : n)));
    clearSelection();
  }
  function bulkExport() {
    const selected = notes.filter((n) => selectedNoteIds.includes(n.id));
    const content = selected.map(noteToMarkdown).join('\n---\n\n');
    downloadBlob(content, `notes-export-${new Date().toISOString().slice(0, 10)}.md`, 'text/markdown');
    clearSelection();
  }
  async function openBulkSharePicker() {
    setBulkSharePickerOpen((v) => !v);
    setBulkShareStatus('');
    if (!supabaseEnabled || !syncUser) return;
    const { data: connData } = await supabase.from('connections').select('*').eq('status', 'accepted').or(`requester_id.eq.${syncUser.id},recipient_id.eq.${syncUser.id}`);
    const otherIds = (connData || []).map((c) => (c.requester_id === syncUser.id ? c.recipient_id : c.requester_id));
    if (otherIds.length === 0) { setBulkShareConnections([]); return; }
    const { data: profileRows } = await supabase.from('profiles').select('id,email').in('id', otherIds);
    setBulkShareConnections(profileRows || []);
  }
  async function bulkShareWith(connectionId) {
    const selected = notes.filter((n) => selectedNoteIds.includes(n.id) && n.cloudId);
    if (selected.length === 0) { setBulkShareStatus("These notes haven't finished syncing yet — try again in a moment."); return; }
    const rows = selected.map((note) => ({ note_id: note.cloudId, owner_id: syncUser.id, shared_with_id: connectionId }));
    const { error } = await supabase.from('note_shares').upsert(rows, { onConflict: 'note_id,shared_with_id' });
    if (error) { setBulkShareStatus('Could not share — try again.'); return; }
    setBulkSharePickerOpen(false);
    clearSelection();
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
          images: Array.isArray(n.images) ? n.images : [],
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
  async function verifyPinWithMfa(e) {
    e.preventDefault();
    setPinMfaError('');
    try {
      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw listErr;
      const totp = factors?.totp?.find((f) => f.status === 'verified');
      if (!totp) throw new Error('No authenticator app found on this account.');
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId: totp.id, challengeId: challenge.id, code: pinMfaCode });
      if (vErr) throw vErr;
      setLocked(false);
      setPinFailCount(0);
      setPinLockUntil(0);
      setPinError('');
      setPinMfaMode(false);
      setPinMfaCode('');
    } catch (err) {
      setPinMfaError(err?.message || 'Invalid code.');
    }
  }
  function tryUnlock() {
    checkPin(pinEntry, () => setLocked(false), setPinError, setPinEntry);
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

          <button onClick={() => { setSimilarFocusId(note.id); setSimilarOpen(true); setNoteMenuOpen(false); }} style={rowStyle}><GitCompare size={15} /> Similar notes</button>

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
              <button onClick={() => openNoteColorCreator({ type: 'note', note })} title="Create new color" aria-label="Create new color" style={{ width: 22, height: 22, borderRadius: 7, background: 'none', border: `1.5px dashed ${muted}`, color: muted, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={13} />
              </button>
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
          <div
            onClick={(e) => {
              if (e.target !== e.currentTarget) return;
              const el = textareaRefs.current[note.id];
              if (!el) return;
              el.focus();
              el.selectionStart = el.selectionEnd = el.value.length;
            }}
            style={mode === 'both' ? { flex: '4 1 0%', minHeight: 0, overflowY: 'auto', ...ruledBg } : { flex: '1 1 auto', minHeight: 120, ...ruledBg }}
          >
            <textarea
              ref={(el) => { textareaRefs.current[note.id] = el; if (el && mode !== 'both') autoGrowTextarea(el); }}
              value={draftBody}
              onChange={(e) => { ensureEditHistory(); setDraftBody(e.target.value); if (mode !== 'both') autoGrowTextarea(e.target); }}
              onPaste={(e) => pasteImageFromClipboard(e, note)}
              onBlur={() => {
                if (autoMoveCompleted) {
                  const reordered = reorderBodyByStrike(draftBody);
                  if (reordered !== draftBody) setDraftBody(reordered);
                }
              }}
              placeholder="Write something..."
              spellCheck={true}
              style={{
                width: '100%', height: mode === 'both' ? '100%' : 'auto', minHeight: mode === 'both' ? '100%' : 120, boxSizing: 'border-box', background: 'transparent', border: 'none', outline: 'none', resize: 'none', overflow: mode === 'both' ? 'auto' : 'hidden',
                fontSize: fz(15), lineHeight: '1.6', color: noteText, padding: 0,
              }}
            />
          </div>
        )}

        {mode !== 'note' && checklistBlock}
      </>
    );
  }

  function TagFooter(note, effectiveBg, colorHex) {
    const noteText = contrastText(effectiveBg);
    const noteMuted = `${noteText}99`;
    return (
      <div style={{ flexShrink: 0, borderTop: `1px solid ${noteText}30` }}>
        <div style={{ padding: '8px 12px 0' }}>
          <VoiceNotes
            ref={voiceNotesRef}
            clips={note.voiceNotes || []}
            onAdd={(clip) => addVoiceNote(note, clip)}
            onDelete={(clipId) => deleteVoiceNote(note, clipId)}
            onRename={(clipId, name) => renameVoiceNote(note, clipId, name)}
            accent={colorHex}
            text={noteText}
            muted={noteMuted}
            compact
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <button onClick={() => voiceNotesRef.current?.toggleRecording()} aria-label="Record voice note" title="Record voice note" style={{ width: 36, height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: `1px dashed ${noteMuted}`, color: noteMuted, borderRadius: 6, cursor: 'pointer', padding: 0 }}>
              <Mic size={15} />
            </button>
            <button onClick={() => noteImagesRef.current?.triggerFilePicker()} aria-label="Add image" title="Add image" style={{ width: 36, height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: `1px dashed ${noteMuted}`, color: noteMuted, borderRadius: 6, cursor: 'pointer', padding: 0 }}>
              <ImageIcon size={15} />
            </button>
            <NoteImages
              ref={noteImagesRef}
              images={note.images || []}
              onAdd={(image) => addImage(note, image)}
              onDelete={(imageId) => deleteImage(note, imageId)}
              onRename={(imageId, name) => renameImage(note, imageId, name)}
              muted={noteMuted}
              compact
            />
          </div>
        </div>
        <div style={{ maxHeight: s(66), padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', overflowY: 'auto' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 12px 8px' }}>
          <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={undo} disabled={past.length === 0} aria-label="Undo" title="Undo" style={{ background: 'none', border: 'none', color: past.length === 0 ? `${noteText}50` : noteText, cursor: past.length === 0 ? 'default' : 'pointer', display: 'flex', padding: 8 }}>
            <Undo2 size={17} />
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={redo} disabled={future.length === 0} aria-label="Redo" title="Redo" style={{ background: 'none', border: 'none', color: future.length === 0 ? `${noteText}50` : noteText, cursor: future.length === 0 ? 'default' : 'pointer', display: 'flex', padding: 8 }}>
            <Redo2 size={17} />
          </button>
        </div>
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
            <button onClick={() => setPendingClose(false)} style={{ background: 'none', color: text, border: borderStyle, borderRadius: 10, padding: '9px 12px', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
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
                onChange={(e) => { ensureEditHistory(); setDraftTitle(e.target.value); }}
                onKeyDown={(e) => titleKeyDown(e, note)}
                onFocus={() => setTitleFocused(true)}
                onBlur={() => setTitleFocused(false)}
                placeholder="Title"
                spellCheck={true}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontFamily: titleFont, fontWeight: 500, fontSize: fz(16), color: headerText, padding: '6px 8px' }}
              />
            </div>
            {note.pinned && <Pin size={16} style={{ color: headerText, opacity: 0.85, flexShrink: 0 }} />}
            {ColorPickerButton(note, headerText)}
            <button onClick={() => toggleNoteMode(note)} aria-label="Switch List/Note mode" title="Switch List/Note mode" style={{ background: 'none', border: `1.5px solid ${headerText}80`, borderRadius: 6, width: 24, height: 24, color: headerText, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, padding: 0 }}>
              {modeLetter}
            </button>
            <button onClick={() => finalizeClose(false)} aria-label="Save & close" title="Save & close" style={{ background: 'none', border: 'none', color: justSaved ? '#DFF3E4' : headerText, cursor: 'pointer', display: 'flex', padding: 4, flexShrink: 0 }}>
              <Save size={20} />
            </button>
            <button onClick={() => setNoteMenuOpen((v) => !v)} aria-label="More options" title="More options" style={{ background: 'none', border: 'none', color: headerText, cursor: 'pointer', display: 'flex', padding: 4, flexShrink: 0 }}>
              <MoreVertical size={20} />
            </button>
            {NoteMenu(note)}
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: `${s(18)}px ${s(20)}px`, position: 'relative' }}>
            {EditorBody(note, colorHex, bg)}
          </div>
          {TagFooter(note, bg, colorHex)}
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
            width: '100%', maxWidth: 560, height: '86dvh', borderRadius: 18, overflow: 'hidden',
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
                onChange={(e) => { ensureEditHistory(); setDraftTitle(e.target.value); }}
                onKeyDown={(e) => titleKeyDown(e, note)}
                placeholder="Title"
                spellCheck={true}
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontFamily: titleFont, fontWeight: 500, fontSize: fz(18), color: panelText, padding: 0 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative', flexShrink: 0 }}>
                {note.pinned && <Pin size={15} style={{ color: panelText, opacity: 0.7 }} />}
                {ColorPickerButton(note, panelText)}
                <button onClick={() => toggleNoteMode(note)} aria-label="Switch List/Note mode" title="Switch List/Note mode" style={{ background: 'none', border: `1.5px solid ${panelText}60`, borderRadius: 6, width: 22, height: 22, color: panelText, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, padding: 0 }}>
                  {modeLetter}
                </button>
                <button onClick={() => finalizeClose(false)} aria-label="Save & close" title="Save & close" style={{ background: 'none', border: 'none', color: justSaved ? '#7FA671' : panelText, cursor: 'pointer', display: 'flex', padding: 4 }}>
                  <Save size={20} />
                </button>
                <button onClick={() => setNoteMenuOpen((v) => !v)} aria-label="More options" title="More options" style={{ background: 'none', border: 'none', color: panelText, cursor: 'pointer', display: 'flex', padding: 4 }}>
                  <MoreVertical size={20} />
                </button>
                {NoteMenu(note)}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: `0 ${s(20)}px` }}>
            {EditorBody(note, colorHex, panelTint)}
          </div>
          {TagFooter(note, panelTint, colorHex)}
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
          {pinMfaMode ? (
            <form onSubmit={verifyPinWithMfa}>
              <input type="text" inputMode="numeric" value={pinMfaCode} onChange={(e) => setPinMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" autoFocus style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center', fontSize: 20, letterSpacing: 4, padding: '10px 12px', borderRadius: 10, border: borderStyle, background: elevated, color: text, outline: 'none', marginBottom: 10 }} />
              {pinMfaError && <div style={{ color: '#E8735F', fontSize: 13, marginBottom: 10 }}>{pinMfaError}</div>}
              <button type="submit" disabled={pinMfaCode.length < 6} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', background: '#E8735F', color: '#fff', fontSize: 14, cursor: 'pointer' }}>Verify</button>
              <button type="button" onClick={() => { setPinMfaMode(false); setPinMfaCode(''); setPinMfaError(''); }} style={{ marginTop: 14, background: 'none', border: 'none', color: muted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Back to PIN</button>
            </form>
          ) : (
            <>
              <input type="password" inputMode="numeric" value={pinEntry} onChange={(e) => setPinEntry(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && tryUnlock()} placeholder="Enter PIN" autoFocus style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center', fontSize: 20, letterSpacing: 4, padding: '10px 12px', borderRadius: 10, border: borderStyle, background: elevated, color: text, outline: 'none', marginBottom: 10 }} />
              {pinError && <div style={{ color: '#E8735F', fontSize: 13, marginBottom: 10 }}>{pinError}</div>}
              <button onClick={tryUnlock} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', background: '#E8735F', color: '#fff', fontSize: 14, cursor: 'pointer' }}>Unlock</button>
              {has2FA && (
                <button onClick={() => { setPinMfaMode(true); setPinError(''); }} style={{ marginTop: 14, background: 'none', border: 'none', color: muted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Can't remember? Use 2FA</button>
              )}
            </>
          )}
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

        @media (max-width: 640px) {
          .app-shell { padding-left: 0 !important; padding-right: 0 !important; }
          .app-header { padding-left: 16px; padding-right: 16px; flex-wrap: nowrap !important; }
          .app-header h1 { font-size: 24px !important; }
        }
      `}</style>

      <div className="app-shell" style={{ maxWidth: 1100, margin: '0 auto', padding: `32px 24px ${allTags.length > 0 ? 184 : 120}px`, position: 'relative', zIndex: 1 }}>
        <div className="app-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 34, margin: 0, letterSpacing: '-0.01em' }}>Makinote</h1>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flex: 1, maxWidth: 720, minWidth: 0 }}>
          <span style={{ fontSize: 10, color: muted, opacity: 0.6 }}>v{APP_VERSION}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
            {syncUser && (
              <button onClick={() => setConnectedNotesOpen(true)} aria-label="Connected notes" title="Connected notes" style={toolbarBtnStyle(false)}>
                <Users size={16} />
              </button>
            )}
            {pinEnabled && <button onClick={() => setLocked(true)} aria-label="Lock now" title="Lock now" style={toolbarBtnStyle(false)}><Lock size={16} /></button>}
            <button onClick={() => setSettingsOpen(true)} aria-label="Settings" title={syncUser ? `Settings — signed in as ${syncUser.email}` : 'Settings'} style={toolbarBtnStyle(false)}>
              <Settings size={16} />
            </button>
          </div>
          </div>
        </div>

        <div style={{ background: elevated, border: borderStyle, borderRadius: 14, marginBottom: 6, boxSizing: 'border-box', overflow: 'hidden' }}>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort notes by" style={{ width: '100%', boxSizing: 'border-box', background: 'transparent', color: text, fontWeight: 600, border: 'none', outline: 'none', padding: '12px 16px', fontSize: 14, cursor: 'pointer' }}>
            {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>Sort by: {opt.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: muted, marginBottom: 10, padding: '0 4px' }}>
          <span>{liveNotes.length} {liveNotes.length === 1 ? 'note' : 'notes'}</span>
          {syncUser && (
            <span
              onClick={() => { if (syncStatus === 'error' && syncError) window.alert(syncError); }}
              title={syncStatus === 'error' ? syncError : undefined}
              style={{ color: syncStatus === 'syncing' ? muted : syncStatus === 'error' ? '#E8735F' : '#7FA671', cursor: syncStatus === 'error' ? 'pointer' : 'default', textDecoration: syncStatus === 'error' ? 'underline' : 'none' }}
            >
              {syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'error' ? 'Sync error (tap for details)' : 'Synced'}
            </span>
          )}
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
                    background: transparentCards ? `${elevated}40` : elevated, border: borderStyle,
                    boxShadow: dark ? '0 1px 2px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.06)', cursor: 'pointer', position: 'relative', color: noteText,
                    userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                  }}
                  onClick={() => handleCardClick(note)}
                  onPointerDown={(e) => handlePressStart(note, e)}
                  onPointerUp={handlePressEnd}
                  onPointerLeave={handlePressEnd}
                  onContextMenu={(e) => handleContextMenu(e, note)}
                >
                  {selectedNoteIds.includes(note.id) && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(128,128,128,0.35)', zIndex: 1, pointerEvents: 'none' }} />
                  )}
                  <div style={{ width: 5, flexShrink: 0, background: colorHex }} />
                  {selectedNoteIds.length > 0 && (
                    <div style={{ position: 'absolute', top: 10, left: 10, width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${selectedNoteIds.includes(note.id) ? '#E8735F' : noteText}80`, background: selectedNoteIds.includes(note.id) ? '#E8735F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                      {selectedNoteIds.includes(note.id) && <Check size={13} color="#fff" />}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0, padding: `${s(16)}px ${s(16)}px ${s(12)}px`, paddingLeft: selectedNoteIds.length > 0 ? s(16) + 26 : s(16) }}>
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
                    {(note.voiceNotes?.length > 0 || note.images?.length > 0 || (note.tags && note.tags.length > 0)) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {note.voiceNotes?.length > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: fz(11), color: `${noteText}90`, background: `${noteText}18`, borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>
                            <Mic size={10} /> voice note
                          </span>
                        )}
                        {note.images?.length > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: fz(11), color: `${noteText}90`, background: `${noteText}18`, borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>
                            <ImageIcon size={10} /> {note.images.length}
                          </span>
                        )}
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
                <div
                  key={note.id}
                  className="note-row"
                  style={{
                    display: 'flex', alignItems: 'center', borderTop: idx === 0 ? 'none' : (sepHex ? `2px solid ${sepHex}` : borderStyle), background: transparentCards ? `${elevated}40` : elevated, cursor: 'pointer', color: noteText, position: 'relative',
                    userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                  }}
                  onClick={() => handleCardClick(note)}
                  onPointerDown={(e) => handlePressStart(note, e)}
                  onPointerUp={handlePressEnd}
                  onPointerLeave={handlePressEnd}
                  onContextMenu={(e) => handleContextMenu(e, note)}
                >
                  {selectedNoteIds.includes(note.id) && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(128,128,128,0.35)', zIndex: 1, pointerEvents: 'none' }} />
                  )}
                  <div style={{ width: 4, alignSelf: 'stretch', flexShrink: 0, background: colorHex }} />
                  {selectedNoteIds.length > 0 && (
                    <div style={{ width: 20, height: 20, marginLeft: 10, flexShrink: 0, borderRadius: '50%', border: `1.5px solid ${selectedNoteIds.includes(note.id) ? '#E8735F' : noteText}80`, background: selectedNoteIds.includes(note.id) ? '#E8735F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
                      {selectedNoteIds.includes(note.id) && <Check size={13} color="#fff" />}
                    </div>
                  )}
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
                        {(note.voiceNotes?.length > 0 || note.images?.length > 0 || (note.tags && note.tags.length > 0)) && (
                          <div style={{ display: 'flex', gap: 5, overflow: 'hidden', whiteSpace: 'nowrap', minWidth: 0 }}>
                            {note.voiceNotes?.length > 0 && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: fz(11), color: `${noteText}90`, background: `${noteText}18`, borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>
                                <Mic size={10} /> voice note
                              </span>
                            )}
                            {note.images?.length > 0 && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: fz(11), color: `${noteText}90`, background: `${noteText}18`, borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>
                                <ImageIcon size={10} /> img
                              </span>
                            )}
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

      {selectedNoteIds.length === 0 && (
        <button onClick={openNewNoteSetup} aria-label="Add note" style={{ position: 'fixed', bottom: allTags.length > 0 ? 92 : 28, right: 28, width: 56, height: 56, borderRadius: '50%', background: '#E8735F', color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(232,115,95,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
          <Plus size={24} />
        </button>
      )}

      {selectedNoteIds.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: elevated, borderTop: borderStyle, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, zIndex: 40, boxShadow: '0 -4px 14px rgba(0,0,0,0.15)' }}>
          <button onClick={clearSelection} aria-label="Cancel selection" title="Cancel selection" style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', display: 'flex', padding: 4 }}><X size={20} /></button>
          <span style={{ fontSize: 14, color: text, fontWeight: 600, flexShrink: 0 }}>{selectedNoteIds.length} selected</span>
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative' }}>
            <button onClick={() => setBulkColorPickerOpen((v) => !v)} aria-label="Set color" title="Set color" style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', display: 'flex', padding: 4 }}><Paintbrush size={20} /></button>
            {bulkColorPickerOpen && (
              <>
                <div onClick={() => setBulkColorPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
                <div style={{ position: 'absolute', bottom: '100%', right: 0, display: 'flex', flexWrap: 'wrap', gap: 6, width: 150, background: elevated, border: borderStyle, borderRadius: 12, boxShadow: '0 -8px 24px rgba(0,0,0,0.35)', padding: 8, zIndex: 2, marginBottom: 6 }}>
                  {customColors.map((c) => (
                    <button key={c.id} onClick={() => bulkSetColor(c.id)} title={c.label} style={{ width: 22, height: 22, borderRadius: 7, background: c.hex, border: '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                  ))}
                </div>
              </>
            )}
          </div>
          {selectedNoteIds.length === 1 && (
            <button onClick={() => { setSimilarFocusId(selectedNoteIds[0]); setSimilarOpen(true); clearSelection(); }} aria-label="Find similar notes" title="Find similar notes" style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', display: 'flex', padding: 4 }}><GitCompare size={20} /></button>
          )}
          <button onClick={bulkExport} aria-label="Export notes" title="Export notes" style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', display: 'flex', padding: 4 }}><Download size={20} /></button>
          {syncUser && (
            <div style={{ position: 'relative' }}>
              <button onClick={openBulkSharePicker} aria-label="Move to connected notes" title="Move to connected notes" style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', display: 'flex', padding: 4 }}><Users size={20} /></button>
              {bulkSharePickerOpen && (
                <>
                  <div onClick={() => setBulkSharePickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
                  <div style={{ position: 'absolute', bottom: '100%', right: 0, display: 'flex', flexDirection: 'column', gap: 4, width: 200, background: elevated, border: borderStyle, borderRadius: 12, boxShadow: '0 -8px 24px rgba(0,0,0,0.35)', padding: 10, zIndex: 2, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: muted, marginBottom: 2 }}>Share with a connection</span>
                    {bulkShareConnections.length === 0 && <span style={{ fontSize: 12, color: muted }}>No connected accounts yet.</span>}
                    {bulkShareConnections.map((c) => (
                      <button key={c.id} onClick={() => bulkShareWith(c.id)} style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', padding: '4px 0', fontSize: 13, textAlign: 'left' }}>{c.email}</button>
                    ))}
                    {bulkShareStatus && <span style={{ fontSize: 11, color: '#E8735F' }}>{bulkShareStatus}</span>}
                  </div>
                </>
              )}
            </div>
          )}
          <button onClick={bulkHide} aria-label="Hide notes" title="Hide notes" style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', display: 'flex', padding: 4 }}><EyeOff size={20} /></button>
          <button onClick={bulkDelete} aria-label="Delete notes" title="Delete notes" style={{ background: 'none', border: 'none', color: '#E8735F', cursor: 'pointer', display: 'flex', padding: 4 }}><Trash2 size={20} /></button>
        </div>
      )}

      {backSaveToast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#2f2f2f', color: '#fff', padding: '8px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600, zIndex: 200, boxShadow: '0 4px 14px rgba(0,0,0,0.35)', pointerEvents: 'none' }}>
          Saved
        </div>
      )}

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
            const isVoice = tag === VOICE_TAG;
            const isImage = tag === IMAGE_TAG;
            return (
              <button
                key={tag}
                onClick={() => setSelectedTagFilters((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, background: active ? '#E8735F' : bg, color: active ? '#fff' : text, border: active ? 'none' : borderStyle,
                  borderRadius: 999, padding: '6px 12px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {isVoice ? (<><Mic size={12} /> voice note</>) : isImage ? (<><ImageIcon size={12} /> img</>) : `# ${tag}`}
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
        <div onClick={closeSettings} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 70 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, maxHeight: '88vh', overflowY: 'auto', overscrollBehavior: 'contain', background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {settingsSection && (
                  <button onClick={backToSettingsHub} aria-label="Back to settings" title="Back to settings" style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', display: 'flex', padding: 0 }}>
                    <ArrowLeft size={18} />
                  </button>
                )}
                <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 22, margin: 0 }}>
                  {settingsSection === 'colors' ? 'Colors' : settingsSection === 'quickNoteColor' ? 'New color' : settingsSection === 'text' ? 'Text' : settingsSection === 'view' ? 'View' : settingsSection === 'other' ? 'Other' : settingsSection === 'account' ? 'Account' : 'Settings'}
                </h2>
              </div>
              <button onClick={closeSettings} aria-label="Close settings" title="Close settings" style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>

            {!settingsSection && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => setSettingsSection('colors')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '12px 14px', fontSize: 15, cursor: 'pointer' }}>
                  <Palette size={17} /> <span style={{ flex: 1, textAlign: 'left' }}>Colors</span> <ChevronRight size={16} style={{ color: muted }} />
                </button>
                <button onClick={() => setSettingsSection('text')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '12px 14px', fontSize: 15, cursor: 'pointer' }}>
                  <Type size={17} /> <span style={{ flex: 1, textAlign: 'left' }}>Text</span> <ChevronRight size={16} style={{ color: muted }} />
                </button>
                <button onClick={() => setSettingsSection('view')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '12px 14px', fontSize: 15, cursor: 'pointer' }}>
                  <LayoutGrid size={17} /> <span style={{ flex: 1, textAlign: 'left' }}>View</span> <ChevronRight size={16} style={{ color: muted }} />
                </button>
                <button onClick={() => setSettingsSection('other')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '12px 14px', fontSize: 15, cursor: 'pointer' }}>
                  <SlidersHorizontal size={17} /> <span style={{ flex: 1, textAlign: 'left' }}>Other</span> <ChevronRight size={16} style={{ color: muted }} />
                </button>
                <button onClick={() => setSettingsSection('account')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '12px 14px', fontSize: 15, cursor: 'pointer' }}>
                  <User size={17} /> <span style={{ flex: 1, textAlign: 'left' }}>Account</span> <ChevronRight size={16} style={{ color: muted }} />
                </button>
              </div>
            )}

            {settingsSection === 'quickNoteColor' && (
              <div>
                <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>Note colors (up to {MAX_CUSTOM})</label>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <ColorWheel size={130} hue={wheelHue} sat={wheelSat} onChange={(h, sat) => { setWheelHue(h); setWheelSat(sat); }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 120 }}>
                    <label style={{ fontSize: 11, color: muted }}>Lightness</label>
                    <LightnessSlider hue={wheelHue} sat={wheelSat} value={wheelLight} onChange={setWheelLight} />
                    <div style={{ width: '100%', height: 28, borderRadius: 8, background: rgbToHex(...hslToRgb(wheelHue, wheelSat, wheelLight)) }} />
                    <button onClick={confirmNewNoteColor} disabled={customColors.length >= MAX_CUSTOM} style={{ padding: '7px 10px', borderRadius: 8, border: 'none', background: '#E8735F', color: '#fff', fontSize: 12, cursor: customColors.length >= MAX_CUSTOM ? 'default' : 'pointer', opacity: customColors.length >= MAX_CUSTOM ? 0.5 : 1 }}>
                      Confirm
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                  {customColors.map((c) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 6, background: c.hex, flexShrink: 0 }} />
                      <input value={c.label} onChange={(e) => renameCustomColor(c.id, e.target.value)} style={{ flex: 1, background: bg, border: borderStyle, borderRadius: 8, padding: '5px 8px', fontSize: 12, color: text, outline: 'none' }} />
                    </div>
                  ))}
                </div>
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

                <div id="note-colors-section" style={{ marginBottom: 20, paddingBottom: 18, borderBottom: borderStyle }}>
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
                          <button onClick={() => requestDeleteColor(c)} aria-label="Delete color" title="Delete color" style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex', padding: 2 }}><X size={13} /></button>
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

            {settingsSection === 'view' && (
              <>
                <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: borderStyle }}>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>Note list layout</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setView('grid')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: view === 'grid' ? '2px solid #E8735F' : borderStyle, background: bg, color: text, fontSize: 13, cursor: 'pointer' }}>
                      <LayoutGrid size={14} /> Grid
                    </button>
                    <button onClick={() => setView('list')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: view === 'list' ? '2px solid #E8735F' : borderStyle, background: bg, color: text, fontSize: 13, cursor: 'pointer' }}>
                      <Rows3 size={14} /> List
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: borderStyle }}>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>Note editor style</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setFullScreenEditor(false)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: !fullScreenEditor ? '2px solid #E8735F' : borderStyle, background: bg, color: text, fontSize: 13, cursor: 'pointer' }}>
                      <Square size={14} /> Popup
                    </button>
                    <button onClick={() => setFullScreenEditor(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: fullScreenEditor ? '2px solid #E8735F' : borderStyle, background: bg, color: text, fontSize: 13, cursor: 'pointer' }}>
                      <Maximize2 size={14} /> Fullscreen
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: borderStyle }}>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 6 }}>Enlarged note transparency: {modalTint}%</label>
                  <input type="range" min={5} max={100} value={modalTint} onChange={(e) => setModalTint(Number(e.target.value))} style={{ width: '100%', ...rangeAccentStyle }} />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 20, paddingBottom: 18, borderBottom: borderStyle, cursor: 'pointer' }}>
                  <input type="checkbox" checked={transparentCards} onChange={(e) => setTransparentCards(e.target.checked)} />
                  See-through notes on the main menu (shows the rain/space background through them)
                </label>

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

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} />
                  Auto-save notes as I type
                </label>
                {!autoSave && <p style={{ fontSize: 12, color: muted, margin: '0' }}>Auto-save is off — changes are kept in the app but won't survive a refresh until you save from within a note.</p>}
              </>
            )}

            {settingsSection === 'other' && (
              <>
                {syncUser && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 20, paddingBottom: 18, borderBottom: borderStyle, cursor: 'pointer' }}>
                    <input type="checkbox" checked={acceptsConnections} onChange={(e) => toggleAcceptsConnections(e.target.checked)} />
                    Allow others to send me connection requests
                  </label>
                )}
                <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: borderStyle }}>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 6 }}>Similar-notes sensitivity: {Math.round(similarThreshold * 100)}% shared words</label>
                  <input type="range" min={5} max={50} value={Math.round(similarThreshold * 100)} onChange={(e) => setSimilarThreshold(Number(e.target.value) / 100)} style={{ width: '100%', marginBottom: 10, ...rangeAccentStyle }} />
                  <button onClick={() => { closeSettings(); setSimilarOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '9px 12px', fontSize: 14, cursor: 'pointer', width: '100%' }}>
                    <GitCompare size={15} /> Find similar notes{similarPairs.length > 0 ? ` (${similarPairs.length})` : ''}
                  </button>
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
                  <AccountPanel onUserChange={setSyncUser} syncStatus={syncStatus} syncError={syncError} text={text} muted={muted} bg={bg} borderStyle={borderStyle} passwordRecovery={passwordRecovery} onRecoveryHandled={() => setPasswordRecovery(false)} onFocusModeChange={setAccountRecoveryFocus} onMfaStatusChange={setHas2FA} />
                </div>

                {!accountRecoveryFocus && (
                  <>
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
                  </>
                )}

                <div>
                  <label style={{ fontSize: 13, color: muted, display: 'block', marginBottom: 8 }}>Connected accounts</label>
                  <ConnectedAccounts syncUser={syncUser} text={text} muted={muted} bg={bg} borderStyle={borderStyle} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {colorToDelete && (
        <div onClick={() => setColorToDelete(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 80 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 340, background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 20, margin: '0 0 10px' }}>Delete color?</h2>
            <p style={{ fontSize: 14, color: muted, margin: '0 0 18px' }}>
              Delete "{colorToDelete.label}"? This can't be undone. Any notes using this color will keep it until you migrate them.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setColorToDelete(null)} style={{ flex: 1, background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '9px 12px', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDeleteColor} style={{ flex: 1, background: '#E8735F', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 12px', fontSize: 14, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {colorMigration && migrationStep === 'ask' && (
        <div onClick={() => setColorMigration(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 80 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 20, margin: '0 0 10px' }}>Color no longer exists</h2>
            <p style={{ fontSize: 14, color: muted, margin: '0 0 10px' }}>
              The below notes use a color that no longer exists. Migrate these notes to a new color?
            </p>
            <ul style={{ margin: '0 0 18px', padding: '0 0 0 18px', fontSize: 13, color: text, maxHeight: 160, overflowY: 'auto' }}>
              {colorMigration.noteTitles.map((title, i) => <li key={i} style={{ marginBottom: 4 }}>{title}</li>)}
            </ul>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setColorMigration(null)} style={{ flex: 1, background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '9px 12px', fontSize: 14, cursor: 'pointer' }}>No thanks</button>
              <button onClick={() => setMigrationStep('pick')} style={{ flex: 1, background: '#E8735F', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 12px', fontSize: 14, cursor: 'pointer' }}>Choose new color</button>
            </div>
          </div>
        </div>
      )}

      {colorMigration && migrationStep === 'pick' && (
        <div onClick={() => setColorMigration(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 80 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 20, margin: '0 0 14px' }}>Pick a new color</h2>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <ColorWheel size={130} hue={wheelHue} sat={wheelSat} onChange={(h, sat) => { setWheelHue(h); setWheelSat(sat); }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 120 }}>
                <label style={{ fontSize: 11, color: muted }}>Lightness</label>
                <LightnessSlider hue={wheelHue} sat={wheelSat} value={wheelLight} onChange={setWheelLight} />
                <div style={{ width: '100%', height: 28, borderRadius: 8, background: rgbToHex(...hslToRgb(wheelHue, wheelSat, wheelLight)) }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={() => setColorMigration(null)} style={{ flex: 1, background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '9px 12px', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmColorMigration} style={{ flex: 1, background: '#E8735F', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 12px', fontSize: 14, cursor: 'pointer' }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {trashOpen && (
        <div onClick={() => setTrashOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto', overscrollBehavior: 'contain', background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 22, margin: 0 }}>Trash</h2>
              <button onClick={() => setTrashOpen(false)} aria-label="Close trash" title="Close trash" style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
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
              <button onClick={() => setHiddenOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
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
        <div onClick={() => { setSimilarOpen(false); setSimilarFocusId(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, maxHeight: '80vh', overflowY: 'auto', overscrollBehavior: 'contain', background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 22, margin: 0 }}>Similar notes</h2>
              <button onClick={() => { setSimilarOpen(false); setSimilarFocusId(null); }} aria-label="Close" style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: muted, display: 'block', marginBottom: 6 }}>Sensitivity: {Math.round(similarThreshold * 100)}% shared words</label>
              <input type="range" min={5} max={50} value={Math.round(similarThreshold * 100)} onChange={(e) => setSimilarThreshold(Number(e.target.value) / 100)} style={{ width: '100%', ...rangeAccentStyle }} />
            </div>
            {(similarFocusId ? similarPairs.filter((p) => p.a.id === similarFocusId || p.b.id === similarFocusId) : similarPairs).length === 0 ? (
              <p style={{ color: muted, fontSize: 14 }}>No likely duplicates found at the current {Math.round(similarThreshold * 100)}% sensitivity.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(similarFocusId ? similarPairs.filter((p) => p.a.id === similarFocusId || p.b.id === similarFocusId) : similarPairs).map((pair, i) => (
                  <div key={i} style={{ border: borderStyle, borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12, color: muted, marginBottom: 6 }}>{Math.round(pair.score * 100)}% similar</div>
                    {[pair.a, pair.b].map((n) => (
                      <button key={n.id} onClick={() => { startEditing(n); setSimilarOpen(false); setSimilarFocusId(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: text, cursor: 'pointer', padding: '4px 0', fontSize: 14 }}>
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
          onClose={closeConnectedNotes}
          onOpen={openSharedNote}
          onCreateForConnection={createNoteForConnection}
          colorHexOf={colorHexOf}
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
              <button onClick={() => openNoteColorCreator({ type: 'newNote' })} title="Create new color" aria-label="Create new color" style={{ width: 30, height: 30, borderRadius: 9, background: 'none', border: `1.5px dashed ${muted}`, color: muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                <Plus size={15} />
              </button>
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
