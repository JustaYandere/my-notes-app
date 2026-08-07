import { useEffect, useRef } from 'react';
import { supabase, supabaseEnabled } from '../lib/supabaseClient';
import { saveNotesLocal } from '../utils/attachmentStorage';

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
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 2000));
    try {
      result = await fn();
    } catch (err) {
      // A genuine network failure (offline, DNS, CORS) throws a "Failed to
      // fetch" TypeError instead of resolving to { data, error } like a
      // Postgres-level error does — without this, those never got retried.
      result = { data: null, error: err };
    }
    if (!result.error) return result;
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

function fromCloudRow(row, localId) {
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
    voiceNotes: row.voice_notes || [],
    images: row.images || [],
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
export function useNotesSync({ notes, setNotes, syncUser, nextIdRef, setSyncStatus, setSyncError, localSaveError, localAttachmentsReady = true }) {
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

  useEffect(() => {
    if (!supabaseEnabled || !syncUser) return;
    if (pullInFlightForUserId === syncUser.id) return;
    pullInFlightForUserId = syncUser.id;
    let cancelled = false;
    (async () => {
      try {
      setSyncStatus?.('syncing');
      const { data, error } = await withRetry(() => supabase.from('notes').select('*').eq('user_id', syncUser.id));
      if (cancelled) return;
      if (error) {
        console.error('Sync pull failed:', error);
        setSyncStatus?.('error');
        setSyncError?.(error.message || 'Could not load your cloud notes.');
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
              const updated = fromCloudRow(row, existing.id);
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
      } finally {
        if (pullInFlightForUserId === syncUser.id) pullInFlightForUserId = null;
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncUser]);

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
    const missing = notes.filter((n) => !n.cloudId);
    if (missing.length > 0) {
      console.log(`[sync] assigning fresh cloudId to ${missing.length} note(s) that don't have one`, missing.map((n) => ({ id: n.id, title: n.title })));
      const withIds = notesRef.current.map((n) => (n.cloudId ? n : { ...n, cloudId: crypto.randomUUID() }));
      notesRef.current = withIds;
      setNotes(withIds);
      saveNotesLocal(withIds);
    }
  }, [notes, syncUser, setNotes, localSaveError]);

  useEffect(() => {
    // Waiting on localAttachmentsReady matters specifically here (not on the
    // pull or cloudId-assignment effects above): until the local IndexedDB
    // attachment merge has finished, a note's images/voiceNotes in `notes`
    // may still be metadata-only (no dataUrl yet). Pushing that up would
    // overwrite the cloud row's real image/audio data with a stripped one.
    if (!supabaseEnabled || !syncUser || pulledForUserRef.current !== syncUser.id || localSaveError || !localAttachmentsReady) return;

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
  }, [notes, syncUser, setSyncStatus, localSaveError, localAttachmentsReady]);

  useEffect(() => {
    if (!supabaseEnabled || !syncUser) return;
    const channel = supabase
      .channel(`notes-${syncUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${syncUser.id}` }, (payload) => {
        if (payload.eventType === 'DELETE' || !payload.new) return;
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
    deleteCloudNote: async (cloudId) => { if (supabaseEnabled && cloudId) await withRetry(() => supabase.from('notes').delete().eq('id', cloudId)); },
    // Batched version for deleting many rows at once (e.g. emptying Trash,
    // cleaning up duplicates) — a single request instead of one per row.
    deleteCloudNotes: async (cloudIds) => { if (supabaseEnabled && cloudIds?.length) await withRetry(() => supabase.from('notes').delete().in('id', cloudIds)); },
  };
}
