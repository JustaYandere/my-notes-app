import { useEffect, useRef, useState } from 'react';
import { supabase, supabaseEnabled } from '../lib/supabaseClient';
import { saveNotesLocal } from '../utils/attachmentStorage';
import { SEED_NOTES } from '../constants';

// Used to recognize a note that's still exactly the default starter content
// shown before this device knows a signed-in account's real cloud state
// (most commonly: local storage got cleared for an already-synced account,
// so hydration fell back to the built-in seed notes). Comparing content
// rather than just id: a genuinely new note the user created, or one they
// edited starting from a seed note, must still sync normally -- only an
// untouched placeholder gets dropped here.
const SEED_FINGERPRINTS = new Map(SEED_NOTES.map((n) => [n.id, JSON.stringify([
  (n.title || '').trim(), (n.body || '').trim(), (n.checklist || []).map((it) => `${it.text}:${it.checked}`),
])]));
function isPristineSeedNote(note) {
  const fp = SEED_FINGERPRINTS.get(note.id);
  if (!fp) return false;
  return fp === JSON.stringify([(note.title || '').trim(), (note.body || '').trim(), (note.checklist || []).map((it) => `${it.text}:${it.checked}`)]);
}

// Module-level, not per-hook-instance: if the app somehow ends up with more
// than one active copy of this hook pulling for the same account at once
// (e.g. React re-firing effects for a syncUser that changed object identity
// without changing account, or any other double-invocation), each instance
// merges the cloud rows against its OWN snapshot of `notes` — neither one
// ever sees the other's additions, so both conclude every single cloud row
// is "new" and add it locally, doubling everything. Since ES modules are
// singletons, this variable is shared across every instance, so only the
// first pull for a given account actually runs.
let pullInFlightForUserId = null;

// Everything except images/voice_notes -- see the comment where this is used.
const LIGHT_COLUMNS = 'id, user_id, title, body, mode, checklist, pinned, hidden, tags, color, reminder_at, reminder_notified, created_at, updated_at, deleted_at';

function toCloudRow(note, userId) {
  return {
    id: note.cloudId,
    user_id: userId,
    title: note.title || '',
    body: note.body || '',
    mode: note.mode || 'note',
    checklist: note.checklist || [],
    pinned: !!note.pinned,
    hidden: !!note.hidden,
    tags: note.tags || [],
    color: note.color || null,
    voice_notes: note.voiceNotes || [],
    images: note.images || [],
    reminder_at: note.reminderAt ? new Date(note.reminderAt).toISOString() : null,
    reminder_notified: !!note.reminderNotified,
    deleted_at: note.deletedAt ? new Date(note.deletedAt).toISOString() : null,
  };
}

function toCloudRowUpdate(note) {
  // eslint-disable-next-line no-unused-vars
  const { id, user_id, ...rest } = toCloudRow(note, null);
  return rest;
}

// Retries a Supabase call a few times with backoff before giving up. A
// "canceling statement due to statement timeout" error from Postgres is
// usually a transient blip (cold-started project, brief contention) rather
// than a real data problem — without a retry, autosave hits this on every
// push it happens to catch mid-blip, which is why it can seem to show up
// "randomly" throughout normal use rather than just on app open.
async function withRetry(fn, attempts = 3) {
  let result;
  for (let attempt = 0; attempt < attempts; attempt++) {
    // Retrying is for transient blips against a connection that's actually
    // there (a cold-started project, brief contention) -- retrying against
    // a connection the browser already knows is down just burns several
    // seconds of backoff for nothing before failing anyway. `navigator.onLine`
    // isn't a perfect signal (a captive portal can look "online"), but it
    // reliably catches "wifi/data is literally off", which is the case this
    // was actually wasting time on.
    if (attempt > 0) {
      if (!navigator.onLine) break;
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
    try {
      result = await fn();
    } catch (err) {
      // A genuine network failure (offline, DNS, CORS) throws a "Failed to
      // fetch" TypeError instead of resolving to { data, error } like a
      // Postgres-level error does — without this, those never got retried.
      result = { data: null, error: err };
    }
    if (!result.error) return result;
    if (!navigator.onLine) break;
  }
  return result;
}

// Defends against a note's real content getting silently replaced by an
// empty version arriving from a sync race (pull merge or realtime echo) —
// a genuinely-cleared note goes through the app's own close-and-delete-if-
// empty flow instead of staying present with blank fields, so a remote row
// that's fully empty while the local note has real content is always more
// likely a race than an intentional edit.
function isBlankRow(row) {
  if (row.images === undefined && row.voice_notes === undefined) {
    // The fast metadata-only pull doesn't select these columns at all, so
    // there's no way to know whether this row actually has attachments --
    // assuming "not blank" here is the safe direction, since the whole
    // point of this check is to avoid mistaking a real note for an empty
    // one and letting it get overwritten.
    return false;
  }
  return !(row.title || '').trim() && !(row.body || '').trim()
    && (!row.checklist || row.checklist.length === 0)
    && (!row.voice_notes || row.voice_notes.length === 0)
    && (!row.images || row.images.length === 0);
}
function hasRealContent(note) {
  return !!(note.title || '').trim() || !!(note.body || '').trim()
    || (note.checklist || []).length > 0
    || (note.voiceNotes || []).length > 0
    || (note.images || []).length > 0;
}

// `existing` (the current local version of this note, if any) is used to
// fill in images/voiceNotes when `row` came from the fast metadata-only
// pull, which doesn't select those columns at all -- without this, merging
// one of those rows over an existing note would wipe its already-synced
// attachments back to empty until the background attachment pass catches up.
function fromCloudRow(row, localId, existing) {
  return {
    id: localId,
    cloudId: row.id,
    title: row.title || '',
    body: row.body || '',
    mode: row.mode || 'note',
    checklist: row.checklist || [],
    pinned: !!row.pinned,
    hidden: !!row.hidden,
    tags: row.tags || [],
    color: row.color,
    voiceNotes: row.voice_notes !== undefined ? (row.voice_notes || []) : (existing?.voiceNotes || []),
    images: row.images !== undefined ? (row.images || []) : (existing?.images || []),
    reminderAt: row.reminder_at ? new Date(row.reminder_at).getTime() : null,
    reminderNotified: !!row.reminder_notified,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
  };
}

// Syncs local `notes` state with a Supabase `notes` table while a user is signed in:
// pulls + merges existing cloud notes on sign-in, pushes local changes (debounced),
// and listens for realtime changes from other devices.
export function useNotesSync({ notes, setNotes, syncUser, nextIdRef, setSyncStatus, setSyncError, localSaveError, localAttachmentsReady = true, onNotesRemoved }) {
  const syncedRef = useRef({}); // local note id -> last-synced updatedAt
  // cloud id -> when we last pushed it ourselves. Postgres sets updated_at
  // via a server-side trigger (its own clock), which never exactly matches
  // our local Date.now() value — so comparing timestamps can't reliably
  // tell an echo of our own write apart from a real external change. This
  // just ignores realtime events for a note we personally wrote a moment
  // ago, which was letting a stale/out-of-order echo clobber a just-saved
  // edit (most visibly losing images) as it bounced back down to us.
  const recentlyPushedRef = useRef({});
  const pushTimerRef = useRef(null);
  const syncUserRef = useRef(syncUser);
  useEffect(() => { syncUserRef.current = syncUser; }, [syncUser]);
  // Always-current mirror of `notes`, used instead of the setNotes(prev =>
  // ...) functional-update form for the pull merge below. React's rules
  // require updater functions passed to setState to be pure -- its
  // reconciler is allowed to invoke them more than once as part of normal
  // (not just StrictMode-dev) operation, discarding all but one result. The
  // pull merge used to read/write syncedRef and nextIdRef *inside* that
  // updater, so every invocation -- including any discarded one -- still
  // ran those side effects for real, which is a very plausible source of
  // the duplicate cloud rows this was chasing. Reading from this ref
  // instead of using the functional form sidesteps the whole issue: the
  // merge becomes a single, plain computation with no function for React
  // to potentially call twice.
  const notesRef = useRef(notes);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  // Which signed-in user we've finished an initial cloud pull for. Assigning
  // cloud ids and pushing must wait for this — otherwise a note that's
  // actually already synced (just not matched locally yet) can get stamped
  // with a brand-new id and re-uploaded as a duplicate before the pull that
  // would have matched it by its real id has had a chance to land.
  const pulledForUserRef = useRef(null);
  // Which signed-in user the background attachment pass (images/voice
  // notes) has completed at least once for. Pushing before this is set
  // risks sending this device's possibly-stale local attachment data (kept
  // only as a placeholder until the real fetch lands) over a genuinely
  // newer image/recording from another device -- worth the small delay to
  // the first push after sign-in to rule that out.
  const attachmentsPulledForUserRef = useRef(null);
  // Mutating the ref above doesn't itself re-trigger the push effect if
  // `notes` hasn't independently changed since (e.g. nothing needed
  // updating during the background pass) -- bumped alongside the ref so the
  // push effect actually re-checks the gate once the pass completes,
  // instead of staying blocked until some unrelated notes change happens to
  // come along and re-evaluate it.
  const [attachmentsPulledTick, setAttachmentsPulledTick] = useState(0);
  // Bumped by the 'online' listener below to re-trigger the pull effect
  // (which otherwise only depends on `syncUser`) once the browser reports
  // connectivity is back, so a pull that failed while offline recovers on
  // its own instead of requiring a manual refresh.
  const [retryTick, setRetryTick] = useState(0);
  useEffect(() => {
    function onOnline() {
      if (syncUser && pulledForUserRef.current !== syncUser.id) setRetryTick((t) => t + 1);
    }
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [syncUser]);

  useEffect(() => {
    if (!supabaseEnabled || !syncUser) return;
    if (pullInFlightForUserId === syncUser.id) return;
    pullInFlightForUserId = syncUser.id;
    let cancelled = false;
    (async () => {
      try {
      setSyncStatus?.('syncing');
      // Images/voice notes are excluded here on purpose: they're base64
      // text embedded directly in the row, and a handful of photos can add
      // up to several MB per note. Fetching the full table on every pull
      // (even when nothing but this device's own edits changed) made every
      // sync take several seconds just moving bytes that hadn't changed. A
      // fast metadata-only pass gets notes on screen almost immediately;
      // attachment bytes get filled in afterward by the background pass
      // below, without blocking anything the user is actually looking at.
      const { data, error } = await withRetry(() => supabase.from('notes').select(LIGHT_COLUMNS).eq('user_id', syncUser.id));
      if (cancelled) return;
      if (error) {
        console.error('Sync pull failed:', error);
        setSyncStatus?.('error');
        setSyncError?.(!navigator.onLine ? "You're offline — will sync automatically once you're back online." : (error.message || 'Could not load your cloud notes.'));
        return;
      }
      {
        const prev = notesRef.current;
        const byCloudId = new Map(prev.filter((n) => n.cloudId).map((n) => [n.cloudId, n]));
        let merged = prev;
        (data || []).forEach((row) => {
          const existing = byCloudId.get(row.id);
          const rowUpdatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
          if (existing) {
            if (rowUpdatedAt > existing.updatedAt && !(isBlankRow(row) && hasRealContent(existing))) {
              const updated = fromCloudRow(row, existing.id, existing);
              merged = merged.map((n) => (n.id === existing.id ? updated : n));
              syncedRef.current[existing.id] = updated.updatedAt;
            } else {
              syncedRef.current[existing.id] = existing.updatedAt;
            }
          } else {
            const localId = nextIdRef.current++;
            const newNote = fromCloudRow(row, localId);
            merged = [...merged, newNote];
            syncedRef.current[localId] = newNote.updatedAt;
          }
        });
        // A note that's already been synced (has a cloudId) but whose row no
        // longer comes back from this query was deleted for real elsewhere
        // (deleteForever/emptyTrash on another device) -- without this, a
        // permanently-deleted note just stays on every device that isn't the
        // one that deleted it, forever, since nothing else ever removes a
        // local note. Shared-with-me notes are excluded: this query only
        // returns rows this account owns, so their absence here means
        // nothing about whether they still exist.
        const fetchedCloudIds = new Set((data || []).map((row) => row.id));
        const staleRemoved = merged.filter((n) => n.cloudId && !n.remoteOwnerId && !fetchedCloudIds.has(n.cloudId));
        // A couple of notes vanishing (someone emptied Trash on another
        // device, deleted a note or two) is normal and should stay
        // automatic. A LARGE fraction of everything this account owns
        // vanishing at once, though, is far more likely to be a bug (an
        // empty/wrong query response, an RLS misconfiguration) than a real
        // mass deletion -- and unlike a normal removal, blindly trusting
        // that signal here would silently wipe those notes from every other
        // device too, the moment they next sync. Skip the removal entirely
        // in that case and just warn instead; nothing destructive happens
        // without a human actually looking at it.
        const previouslySyncedCount = merged.filter((n) => n.cloudId && !n.remoteOwnerId).length;
        const massRemoval = previouslySyncedCount > 0 && staleRemoved.length / previouslySyncedCount >= 0.5;
        if (staleRemoved.length && !massRemoval) merged = merged.filter((n) => !n.cloudId || n.remoteOwnerId || fetchedCloudIds.has(n.cloudId));
        notesRef.current = merged;
        setNotes(merged);
        // Written directly to disk here, independent of the user's "auto-save
        // notes as I type" preference: that setting is about discarding
        // in-progress typing, not about whether already-committed cloud data
        // is allowed to survive a refresh. If this is skipped when auto-save
        // is off, cloud rows never land in localStorage, so every reload
        // starts over from stale local data and re-pulls (and re-pushes)
        // everything, compounding forever.
        saveNotesLocal(merged);
        if (staleRemoved.length) onNotesRemoved?.(staleRemoved, massRemoval ? 'mass-removal-blocked' : 'deleted-elsewhere');
      }

      // NOTE: this used to also auto-delete the losing side of a duplicate
      // pair (and empty notes) straight from Supabase on every single pull,
      // with no confirmation. A user hit a case where it kept finding a
      // "duplicate" pair on every reload and permanently deleting from the
      // cloud each time, with no way to know why or undo it. Disabled the
      // automatic destructive part entirely — duplicate/empty cleanup is
      // now only ever done via the explicit "Clean up duplicate & empty
      // notes" button in Settings, which the user consciously triggers and
      // which still goes through the same safe batched-delete path.
      pulledForUserRef.current = syncUser.id;
      setSyncStatus?.('idle');
      setSyncError?.('');

      // Background pass: fetch just the attachment bytes and merge them in
      // once ready, without making the user wait for it. Deliberately not
      // awaited (and not inside this try/finally), so it doesn't hold the
      // "pull in flight" guard open for however long a few MB of images
      // takes -- a second legitimate pull (e.g. a fresh sign-in) shouldn't
      // be blocked behind this.
      (async () => {
        const { data: attachRows, error: attachError } = await withRetry(() => supabase.from('notes').select('id, images, voice_notes').eq('user_id', syncUser.id));
        if (cancelled || attachError || !attachRows) return;
        attachmentsPulledForUserRef.current = syncUser.id;
        setAttachmentsPulledTick((t) => t + 1);
        const byCloudId = new Map(attachRows.map((r) => [r.id, r]));
        const current = notesRef.current;
        let changed = false;
        const withAttachments = current.map((n) => {
          if (!n.cloudId) return n;
          const match = byCloudId.get(n.cloudId);
          if (!match) return n;
          const newImages = match.images || [];
          const newVoice = match.voice_notes || [];
          if (JSON.stringify(newImages) === JSON.stringify(n.images || []) && JSON.stringify(newVoice) === JSON.stringify(n.voiceNotes || [])) return n;
          changed = true;
          return { ...n, images: newImages, voiceNotes: newVoice };
        });
        if (!changed) return;
        notesRef.current = withAttachments;
        setNotes(withAttachments);
        saveNotesLocal(withAttachments);
      })();
      } finally {
        if (pullInFlightForUserId === syncUser.id) pullInFlightForUserId = null;
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncUser, retryTick]);

  // Assign a stable client-generated cloud id to any note that doesn't have one yet,
  // synchronously (no network round trip) so a reload/crash mid-sync can never cause
  // the same note to be inserted twice.
  //
  // Gated on localSaveError being false: assigning a cloudId only actually
  // protects against a duplicate insert if it *stays* assigned once saved to
  // disk. If local writes are silently failing (e.g. localStorage quota),
  // the assignment made here never survives to the next reload — the note
  // looks cloudId-less again, gets a *new* one, and gets pushed as a brand
  // new row. Repeated every reload, that's a permanent duplicate added to
  // the cloud every single time, which is worse than doing nothing.
  useEffect(() => {
    if (!supabaseEnabled || !syncUser || pulledForUserRef.current !== syncUser.id || localSaveError) return;
    const current = notesRef.current;
    const staleSeedIds = new Set(current.filter((n) => !n.cloudId && isPristineSeedNote(n)).map((n) => n.id));
    if (staleSeedIds.size > 0) console.log(`[sync] dropping ${staleSeedIds.size} untouched starter note(s) instead of syncing them as new`, [...staleSeedIds]);
    const withoutStaleSeeds = staleSeedIds.size > 0 ? current.filter((n) => !staleSeedIds.has(n.id)) : current;
    const missing = withoutStaleSeeds.filter((n) => !n.cloudId);
    if (staleSeedIds.size === 0 && missing.length === 0) return;
    if (missing.length > 0) console.log(`[sync] assigning fresh cloudId to ${missing.length} note(s) that don't have one`, missing.map((n) => ({ id: n.id, title: n.title })));
    const withIds = withoutStaleSeeds.map((n) => (n.cloudId ? n : { ...n, cloudId: crypto.randomUUID() }));
    notesRef.current = withIds;
    setNotes(withIds);
    saveNotesLocal(withIds);
  }, [notes, syncUser, setNotes, localSaveError]);

  useEffect(() => {
    // Waiting on localAttachmentsReady matters specifically here (not on the
    // pull or cloudId-assignment effects above): until the local IndexedDB
    // attachment merge has finished, a note's images/voiceNotes in `notes`
    // may still be metadata-only (no dataUrl yet). Pushing that up would
    // overwrite the cloud row's real image/audio data with a stripped one.
    // attachmentsPulledForUserRef guards the analogous cloud-side race: the
    // fast metadata-only pull can't tell us what a note's attachments
    // actually are right now, so pushing before the background attachment
    // pass has completed at least once risks sending stale local data over
    // a genuinely newer image/recording from another device.
    if (!supabaseEnabled || !syncUser || pulledForUserRef.current !== syncUser.id || attachmentsPulledForUserRef.current !== syncUser.id || localSaveError || !localAttachmentsReady) return;

    async function doPush() {
      if (!syncUserRef.current) return;
      const dirty = notes.filter((n) => n.cloudId && syncedRef.current[n.id] !== n.updatedAt);
      if (dirty.length === 0) return;
      console.log(`[sync] pushing ${dirty.length} dirty note(s)`, dirty.map((n) => ({ id: n.id, cloudId: n.cloudId, title: n.title, lastSyncedAt: syncedRef.current[n.id], updatedAt: n.updatedAt })));
      setSyncStatus?.('syncing');
      let hadError = false;
      let lastErrorMessage = '';

      const mine = dirty.filter((n) => !n.remoteOwnerId);
      const shared = dirty.filter((n) => n.remoteOwnerId);

      // Owned notes can all go up in a single bulk upsert instead of one
      // request per note — much faster for an initial sync of many notes.
      if (mine.length > 0) {
        const { error } = await withRetry(() => supabase.from('notes').upsert(mine.map((n) => toCloudRow(n, syncUser.id))));
        if (error) {
          console.error('Sync push failed:', error);
          hadError = true;
          lastErrorMessage = error.message || 'Could not save your notes to the cloud.';
        } else {
          const pushedAt = Date.now();
          mine.forEach((n) => { syncedRef.current[n.id] = n.updatedAt; recentlyPushedRef.current[n.cloudId] = pushedAt; });
        }
      }

      // Notes shared with me by someone else: update content only, one at a
      // time (each targets a different row with different values), and
      // never touch id/user_id, or I'd hijack ownership of their note.
      for (const note of shared) {
        if (!syncUserRef.current) break;
        const { error } = await withRetry(() => supabase.from('notes').update(toCloudRowUpdate(note)).eq('id', note.cloudId));
        if (error) {
          console.error('Sync push failed:', error);
          hadError = true;
          lastErrorMessage = error.message || 'Could not save a shared note to the cloud.';
          continue;
        }
        syncedRef.current[note.id] = note.updatedAt;
        recentlyPushedRef.current[note.cloudId] = Date.now();
      }

      if (syncUserRef.current) {
        setSyncStatus?.(hadError ? 'error' : 'idle');
        setSyncError?.(hadError ? lastErrorMessage : '');
      }
    }

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(doPush, 800);

    // Best-effort: if the tab is about to close, refresh, or go to the
    // background (phone home button, app switcher), push immediately
    // instead of waiting out the debounce. A change made right before any
    // of those otherwise never reaches the cloud at all -- the debounce
    // timer just gets torn down with the rest of the page, silently.
    function flushOnHide() {
      if (document.visibilityState === 'hidden') {
        clearTimeout(pushTimerRef.current);
        doPush();
      }
    }
    document.addEventListener('visibilitychange', flushOnHide);
    window.addEventListener('pagehide', flushOnHide);

    return () => {
      clearTimeout(pushTimerRef.current);
      document.removeEventListener('visibilitychange', flushOnHide);
      window.removeEventListener('pagehide', flushOnHide);
    };
  }, [notes, syncUser, setSyncStatus, localSaveError, localAttachmentsReady, attachmentsPulledTick]);

  useEffect(() => {
    if (!supabaseEnabled || !syncUser) return;
    const channel = supabase
      .channel(`notes-${syncUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${syncUser.id}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          // A permanent delete (deleteForever/emptyTrash) elsewhere -- remove
          // the matching local copy so it doesn't just sit here forever. Only
          // the primary key is guaranteed present on a delete payload.
          const deletedCloudId = payload.old?.id;
          if (!deletedCloudId) return;
          const prev = notesRef.current;
          const removedNote = prev.find((n) => n.cloudId === deletedCloudId);
          if (!removedNote) return;
          const next = prev.filter((n) => n.cloudId !== deletedCloudId);
          notesRef.current = next;
          setNotes(next);
          saveNotesLocal(next);
          onNotesRemoved?.([removedNote], 'deleted-elsewhere');
          return;
        }
        if (!payload.new) return;
        const row = payload.new;
        const pushedAt = recentlyPushedRef.current[row.id];
        if (pushedAt && Date.now() - pushedAt < 5000) return;
        const prev = notesRef.current;
        const existing = prev.find((n) => n.cloudId === row.id);
        let next;
        if (existing) {
          if (isBlankRow(row) && hasRealContent(existing)) return;
          const updated = fromCloudRow(row, existing.id);
          syncedRef.current[existing.id] = updated.updatedAt;
          next = prev.map((n) => (n.id === existing.id ? updated : n));
        } else {
          const localId = nextIdRef.current++;
          const newNote = fromCloudRow(row, localId);
          syncedRef.current[localId] = newNote.updatedAt;
          next = [...prev, newNote];
        }
        notesRef.current = next;
        setNotes(next);
        saveNotesLocal(next);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncUser]);

  return {
    // .select('id') on the delete makes Postgres hand back which rows it
    // actually removed -- a delete a Row Level Security policy silently
    // blocks (e.g. a DELETE policy that's missing or narrower than the
    // SELECT one) resolves with no error and zero affected rows, not a
    // rejection, so without checking the returned rows this looks
    // identical to success. That's a real, confirmed-plausible way for
    // "cleaned up" duplicates to keep coming back forever.
    deleteCloudNote: async (cloudId) => {
      if (!supabaseEnabled || !cloudId) return true;
      const { data, error } = await withRetry(() => supabase.from('notes').delete().eq('id', cloudId).select('id'));
      if (error) { console.error('Cloud delete failed:', error); return false; }
      if (!data || data.length === 0) { console.error('Cloud delete affected 0 rows (likely blocked by Row Level Security):', cloudId); return false; }
      return true;
    },
    // Batched version for deleting many rows at once (e.g. emptying Trash,
    // cleaning up duplicates) — a single request instead of one per row.
    // Returns the cloudIds that were requested but NOT actually deleted.
    deleteCloudNotes: async (cloudIds) => {
      if (!supabaseEnabled || !cloudIds?.length) return [];
      const { data, error } = await withRetry(() => supabase.from('notes').delete().in('id', cloudIds).select('id'));
      if (error) { console.error('Cloud delete failed:', error); return cloudIds; }
      const actuallyDeleted = new Set((data || []).map((row) => row.id));
      const notDeleted = cloudIds.filter((id) => !actuallyDeleted.has(id));
      if (notDeleted.length) console.error('Cloud delete affected fewer rows than requested (likely blocked by Row Level Security):', notDeleted);
      return notDeleted;
    },
  };
}
