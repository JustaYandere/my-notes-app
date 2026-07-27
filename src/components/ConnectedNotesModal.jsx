import { useState, useEffect } from 'react';
import { X, Copy } from 'lucide-react';
import { supabase, supabaseEnabled } from '../lib/supabaseClient';

export default function ConnectedNotesModal({ syncUser, onClose, onCopy, text, muted, bg, elevated, borderStyle }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!supabaseEnabled || !syncUser) return;
    let cancelled = false;
    async function load() {
      const { data: shares } = await supabase.from('note_shares').select('*').eq('shared_with_id', syncUser.id);
      if (cancelled) return;
      const noteIds = (shares || []).map((s) => s.note_id);
      if (noteIds.length === 0) { setItems([]); return; }
      const { data: notesData } = await supabase.from('notes').select('*').in('id', noteIds);
      if (cancelled) return;
      const ownerIds = [...new Set((shares || []).map((s) => s.owner_id))];
      const { data: profileRows } = await supabase.from('profiles').select('id,email').in('id', ownerIds);
      if (cancelled) return;
      const emailMap = {};
      (profileRows || []).forEach((p) => { emailMap[p.id] = p.email; });
      const merged = (shares || [])
        .map((s) => ({ share: s, note: (notesData || []).find((n) => n.id === s.note_id), ownerEmail: emailMap[s.owner_id] }))
        .filter((x) => x.note);
      setItems(merged);
    }
    load();
    const channel = supabase
      .channel(`shared-with-${syncUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'note_shares' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [syncUser]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, maxHeight: '80vh', overflowY: 'auto', overscrollBehavior: 'contain', background: elevated, borderRadius: 16, border: borderStyle, padding: 22, color: text }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 22, margin: 0 }}>Connected notes</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
        </div>
        {!supabaseEnabled || !syncUser ? (
          <p style={{ fontSize: 13, color: muted }}>Sign in to see notes shared with you.</p>
        ) : items.length === 0 ? (
          <p style={{ fontSize: 13, color: muted }}>No notes have been shared with you yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(({ share, note, ownerEmail }) => (
              <div key={share.id} style={{ background: bg, border: borderStyle, borderRadius: 12, padding: 14 }}>
                <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 4 }}>{note.title || 'Untitled'}</div>
                {note.body && <div style={{ fontSize: 13, color: muted, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{note.body.slice(0, 200)}</div>}
                <div style={{ fontSize: 11, color: muted, marginBottom: 8 }}>Shared by {ownerEmail}</div>
                <button onClick={() => onCopy(note)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8735F', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 10px', fontSize: 12, cursor: 'pointer' }}>
                  <Copy size={13} /> Copy to my notes
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
