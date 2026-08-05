import { useEffect, useRef } from 'react';
import { supabase, supabaseEnabled } from '../lib/supabaseClient';

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
export function useNotesSync({ notes, setNotes, syncUser, nextIdRef, setSyncStatus, setSyncError }) {
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
  // Which signed-in user we've finished an initial cloud pull for. Assigning
  // cloud ids and pushing must wait for this — otherwise a note that's
  // actually already synced (just not matched locally yet) can get stamped
  // with a brand-new id and re-uploaded as a duplicate before the pull that
  // would have matched it by its real id has had a chance to land.
  const pulledForUserRef = useRef(null);

  useEffect(() => {
    if (!supabaseEnabled || !syncUser) return;
    let cancelled = false;
    (async () => {
      setSyncStatus?.('syncing');
      const { data, error } = await withRetry(() => supabase.from('notes').select('*').eq('user_id', syncUser.id));
      if (cancelled) return;
      if (error) {
        console.error('Sync pull failed:', error);
        setSyncStatus?.('error');
        setSyncError?.(error.message || 'Could not load your cloud notes.');
        return;
      }
      let mergedResult = [];
      setNotes((prev) => {
        const byCloudId = new Map(prev.filter((n) => n.cloudId).map((n) => [n.cloudId, n]));
        let merged = prev;
        (data || []).forEach((row) => {
          const existing = byCloudId.get(row.id);
          const rowUpdatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
          if (existing) {
            if (rowUpdatedAt > existing.updatedAt) {
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
        mergedResult = merged;
        return merged;
      });

      // Safety net: collapse any notes that ended up as exact-content
      // duplicates (e.g. from a past sync race), keeping the newest.
      const fingerprintOf = (n) => JSON.stringify([
        (n.title || '').trim(), (n.body || '').trim(), n.mode,
        (n.checklist || []).map((it) => `${it.text}:${it.checked}`),
      ]);
      const groups = new Map();
      mergedResult
        .filter((n) => !n.deletedAt && !n.remoteOwnerId && ((n.title || '').trim() || (n.body || '').trim()))
        .forEach((n) => {
          const key = fingerprintOf(n);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(n);
        });
      const idsToRemove = [];
      const cloudIdsToDelete = [];
      groups.forEach((group) => {
        if (group.length < 2) return;
        [...group].sort((a, b) => b.updatedAt - a.updatedAt).slice(1).forEach((n) => {
          idsToRemove.push(n.id);
          if (n.cloudId) cloudIdsToDelete.push(n.cloudId);
        });
      });
      // Also sweep out any empty notes pulled down from the cloud (e.g. left
      // over from before auto-delete-on-close existed, or from another device).
      mergedResult
        .filter((n) => !n.deletedAt && !n.remoteOwnerId && idsToRemove.indexOf(n.id) === -1)
        .forEach((n) => {
          const isEmpty = !(n.title || '').trim() && !(n.body || '').trim()
            && (!n.checklist || n.checklist.length === 0)
            && (!n.voiceNotes || n.voiceNotes.length === 0)
            && (!n.images || n.images.length === 0)
            && (!n.tags || n.tags.length === 0);
          if (isEmpty) {
            idsToRemove.push(n.id);
            if (n.cloudId) cloudIdsToDelete.push(n.cloudId);
          }
        });

      if (idsToRemove.length > 0) {
        setNotes((prev) => prev.filter((n) => !idsToRemove.includes(n.id)));
        // One batched delete instead of N concurrent ones — firing a delete
        // per row at once can exhaust the connection pool / pile up lock
        // contention and trip Postgres's statement_timeout.
        if (cloudIdsToDelete.length > 0) withRetry(() => supabase.from('notes').delete().in('id', cloudIdsToDelete));
      }

      pulledForUserRef.current = syncUser.id;
      setSyncStatus?.('idle');
      setSyncError?.('');
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncUser]);

  // Assign a stable client-generated cloud id to any note that doesn't have one yet,
  // synchronously (no network round trip) so a reload/crash mid-sync can never cause
  // the same note to be inserted twice.
  useEffect(() => {
    if (!supabaseEnabled || !syncUser || pulledForUserRef.current !== syncUser.id) return;
    if (notes.some((n) => !n.cloudId)) {
      setNotes((prev) => prev.map((n) => (n.cloudId ? n : { ...n, cloudId: crypto.randomUUID() })));
    }
  }, [notes, syncUser, setNotes]);

  useEffect(() => {
    if (!supabaseEnabled || !syncUser || pulledForUserRef.current !== syncUser.id) return;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      if (!syncUserRef.current) return;
      const dirty = notes.filter((n) => n.cloudId && syncedRef.current[n.id] !== n.updatedAt);
      if (dirty.length === 0) return;
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
    }, 800);
    return () => clearTimeout(pushTimerRef.current);
  }, [notes, syncUser, setSyncStatus]);

  useEffect(() => {
    if (!supabaseEnabled || !syncUser) return;
    const channel = supabase
      .channel(`notes-${syncUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${syncUser.id}` }, (payload) => {
        if (payload.eventType === 'DELETE' || !payload.new) return;
        const row = payload.new;
        const pushedAt = recentlyPushedRef.current[row.id];
        if (pushedAt && Date.now() - pushedAt < 5000) return;
        setNotes((prev) => {
          const existing = prev.find((n) => n.cloudId === row.id);
          if (existing) {
            const updated = fromCloudRow(row, existing.id);
            syncedRef.current[existing.id] = updated.updatedAt;
            return prev.map((n) => (n.id === existing.id ? updated : n));
          }
          const localId = nextIdRef.current++;
          const newNote = fromCloudRow(row, localId);
          syncedRef.current[localId] = newNote.updatedAt;
          return [...prev, newNote];
        });
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
