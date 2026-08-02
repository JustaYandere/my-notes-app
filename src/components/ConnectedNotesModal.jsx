import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Users } from 'lucide-react';
import { supabase, supabaseEnabled } from '../lib/supabaseClient';

export default function ConnectedNotesModal({ syncUser, onClose, onOpen, onCreateForConnection, colorHexOf, text, muted, bg, elevated, borderStyle }) {
  const [items, setItems] = useState([]);
  const [connections, setConnections] = useState([]);
  const [newNoteTarget, setNewNoteTarget] = useState('');
  const [filterConnection, setFilterConnection] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabaseEnabled || !syncUser) return;
    // The connections lookup and the two note_shares lookups don't depend on
    // each other — firing them together instead of one-after-another cuts
    // this from 5 sequential round trips down to 2 "waves", which is most of
    // where the multi-second load time was coming from.
    const [{ data: connRows }, { data: sharesIn }, { data: sharesOut }] = await Promise.all([
      supabase.from('connections').select('*').eq('status', 'accepted').or(`requester_id.eq.${syncUser.id},recipient_id.eq.${syncUser.id}`),
      supabase.from('note_shares').select('*').eq('shared_with_id', syncUser.id),
      supabase.from('note_shares').select('*').eq('owner_id', syncUser.id),
    ]);
    const otherIds = (connRows || []).map((c) => (c.requester_id === syncUser.id ? c.recipient_id : c.requester_id));
    const allShares = [...(sharesIn || []), ...(sharesOut || [])];
    const noteIds = [...new Set(allShares.map((s) => s.note_id))];

    const [{ data: profileRows }, { data: notesData }] = await Promise.all([
      otherIds.length > 0 ? supabase.from('profiles').select('id,email').in('id', otherIds) : Promise.resolve({ data: [] }),
      noteIds.length > 0 ? supabase.from('notes').select('*').in('id', noteIds) : Promise.resolve({ data: [] }),
    ]);
    const emailMap = {};
    (profileRows || []).forEach((p) => { emailMap[p.id] = p.email; });
    setConnections(otherIds.map((id) => ({ id, email: emailMap[id] })));

    const merged = allShares
      .map((s) => {
        const note = (notesData || []).find((n) => n.id === s.note_id);
        const isMine = s.owner_id === syncUser.id;
        const otherId = isMine ? s.shared_with_id : s.owner_id;
        return { share: s, note, otherId, otherEmail: emailMap[otherId], isMine };
      })
      .filter((x) => x.note);
    setItems(merged);
    setLoading(false);
  }, [syncUser]);

  useEffect(() => {
    if (!supabaseEnabled || !syncUser) return;
    let cancelled = false;
    (async () => { if (!cancelled) await load(); })();
    const channel = supabase
      .channel(`shared-with-${syncUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'note_shares' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [syncUser, load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- defaults the picker to the first connection once loaded
    if (!newNoteTarget && connections.length > 0) setNewNoteTarget(connections[0].id);
  }, [connections, newNoteTarget]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, maxHeight: '80vh', overflowY: 'auto', overscrollBehavior: 'contain', background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 22, margin: 0 }}>Connected notes</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: text, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
        </div>
        {!supabaseEnabled || !syncUser ? (
          <p style={{ fontSize: 13, color: muted }}>Sign in to share and co-edit notes with connected accounts.</p>
        ) : (
          <>
            {connections.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
                <select value={newNoteTarget} onChange={(e) => setNewNoteTarget(e.target.value)} style={{ flex: 1, background: bg, border: borderStyle, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: text, outline: 'none' }}>
                  {connections.map((c) => <option key={c.id} value={c.id}>{c.email}</option>)}
                </select>
                <button onClick={() => onCreateForConnection(newNoteTarget)} disabled={!newNoteTarget} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8735F', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <Plus size={14} /> New note
                </button>
              </div>
            )}

            {loading ? (
              <p style={{ fontSize: 13, color: muted }}>Loading…</p>
            ) : items.length === 0 ? (
              <p style={{ fontSize: 13, color: muted }}>No connected notes yet — share one from a note's menu, or create one above.</p>
            ) : (
              <>
                {connections.length > 1 && (
                  <select value={filterConnection} onChange={(e) => setFilterConnection(e.target.value)} style={{ width: '100%', background: bg, border: borderStyle, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: text, outline: 'none', marginBottom: 12 }}>
                    <option value="all">All connections</option>
                    {connections.map((c) => <option key={c.id} value={c.id}>{c.email}</option>)}
                  </select>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.filter((x) => filterConnection === 'all' || x.otherId === filterConnection).map(({ share, note, otherEmail }) => (
                  <button
                    key={share.id}
                    onClick={() => onOpen(note, share)}
                    style={{ display: 'flex', alignItems: 'stretch', width: '100%', textAlign: 'left', background: bg, border: borderStyle, borderRadius: 12, overflow: 'hidden', padding: 0, cursor: 'pointer', color: text }}
                  >
                    <div style={{ width: 4, flexShrink: 0, background: colorHexOf ? colorHexOf(note.color) : 'transparent' }} />
                    <div style={{ flex: 1, minWidth: 0, padding: 14 }}>
                      <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 4 }}>{note.title || 'Untitled'}</div>
                      {note.body && <div style={{ fontSize: 13, color: muted, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{note.body.slice(0, 200)}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: muted }}>
                        <Users size={11} /> Shared with {otherEmail}
                      </div>
                    </div>
                  </button>
                ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
