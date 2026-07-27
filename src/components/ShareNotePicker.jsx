import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { supabase, supabaseEnabled } from '../lib/supabaseClient';

export default function ShareNotePicker({ note, syncUser, text, muted }) {
  const [connections, setConnections] = useState([]);
  const [sharedWith, setSharedWith] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabaseEnabled || !syncUser || !note.cloudId) return;
    let cancelled = false;
    (async () => {
      const { data: connData } = await supabase
        .from('connections')
        .select('*')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${syncUser.id},recipient_id.eq.${syncUser.id}`);
      if (cancelled) return;
      const otherIds = (connData || []).map((c) => (c.requester_id === syncUser.id ? c.recipient_id : c.requester_id));
      if (otherIds.length === 0) { setConnections([]); return; }
      const { data: profileRows } = await supabase.from('profiles').select('id,email').in('id', otherIds);
      if (cancelled) return;
      setConnections(profileRows || []);
      const { data: shareRows } = await supabase.from('note_shares').select('shared_with_id').eq('note_id', note.cloudId);
      if (!cancelled) setSharedWith((shareRows || []).map((r) => r.shared_with_id));
    })();
    return () => { cancelled = true; };
  }, [syncUser, note.cloudId]);

  async function toggleShare(id) {
    setError('');
    if (sharedWith.includes(id)) {
      await supabase.from('note_shares').delete().eq('note_id', note.cloudId).eq('shared_with_id', id);
      setSharedWith((prev) => prev.filter((x) => x !== id));
    } else {
      const { error: insertError } = await supabase.from('note_shares').insert({ note_id: note.cloudId, owner_id: syncUser.id, shared_with_id: id });
      if (insertError) { setError('Could not share — try again.'); return; }
      setSharedWith((prev) => [...prev, id]);
    }
  }

  if (!supabaseEnabled || !syncUser) {
    return <p style={{ fontSize: 11, color: muted, padding: '0 12px 8px', margin: 0 }}>Sign in to share notes with connected accounts.</p>;
  }
  if (!note.cloudId) {
    return <p style={{ fontSize: 11, color: muted, padding: '0 12px 8px', margin: 0 }}>This note is still syncing — try again in a moment.</p>;
  }
  if (connections.length === 0) {
    return <p style={{ fontSize: 11, color: muted, padding: '0 12px 8px', margin: 0 }}>No connected accounts yet — connect with someone in Settings → Account first.</p>;
  }

  return (
    <div style={{ padding: '4px 12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {connections.map((c) => (
        <button key={c.id} onClick={() => toggleShare(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: text, cursor: 'pointer', padding: '4px 0', fontSize: 12, textAlign: 'left' }}>
          <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${muted}`, background: sharedWith.includes(c.id) ? '#7FA671' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {sharedWith.includes(c.id) && <Check size={11} color="#fff" />}
          </span>
          {c.email}
        </button>
      ))}
      {error && <span style={{ fontSize: 11, color: '#E8735F' }}>{error}</span>}
    </div>
  );
}
