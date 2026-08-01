import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Check, X as XIcon } from 'lucide-react';
import { supabase, supabaseEnabled } from '../lib/supabaseClient';

export default function ConnectedAccounts({ syncUser, text, muted, bg, borderStyle }) {
  const [rows, setRows] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!supabaseEnabled || !syncUser) return;
    const { data } = await supabase
      .from('connections')
      .select('*')
      .or(`requester_id.eq.${syncUser.id},recipient_id.eq.${syncUser.id}`);
    setRows(data || []);
    const otherIds = [...new Set((data || []).map((r) => (r.requester_id === syncUser.id ? r.recipient_id : r.requester_id)))];
    if (otherIds.length > 0) {
      const { data: profileRows } = await supabase.from('profiles').select('id,email').in('id', otherIds);
      const map = {};
      (profileRows || []).forEach((p) => { map[p.id] = p.email; });
      setProfiles(map);
    }
  }, [syncUser]);

  useEffect(() => {
    if (!supabaseEnabled || !syncUser) return;
    let cancelled = false;
    (async () => { if (!cancelled) await load(); })();
    const channel = supabase
      .channel(`connections-${syncUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [syncUser, load]);

  async function handleConnect(e) {
    e.preventDefault();
    setError('');
    if (email.trim().toLowerCase() === syncUser.email.toLowerCase()) { setError("That's your own account."); return; }
    setLoading(true);
    const { data: found, error: lookupError } = await supabase.from('profiles').select('id,email').ilike('email', email.trim()).maybeSingle();
    if (lookupError || !found) { setError('No account found with that email.'); setLoading(false); return; }
    const { error: insertError } = await supabase.from('connections').insert({ requester_id: syncUser.id, recipient_id: found.id, status: 'pending' });
    if (insertError) {
      const msg = insertError.message.includes('duplicate')
        ? 'Already connected or pending.'
        : insertError.message.includes('row-level security')
          ? "This person isn't accepting connection requests right now."
          : insertError.message;
      setError(msg);
    }
    else { setEmail(''); load(); }
    setLoading(false);
  }

  async function handleAccept(id) { await supabase.from('connections').update({ status: 'accepted' }).eq('id', id); load(); }
  async function handleRemove(id) { await supabase.from('connections').delete().eq('id', id); load(); }

  if (!supabaseEnabled) return null;
  if (!syncUser) return <p style={{ fontSize: 12, color: muted, margin: 0 }}>Sign in to connect with other accounts.</p>;

  const incoming = rows.filter((r) => r.status === 'pending' && r.recipient_id === syncUser.id);
  const outgoing = rows.filter((r) => r.status === 'pending' && r.requester_id === syncUser.id);
  const accepted = rows.filter((r) => r.status === 'accepted');

  return (
    <div>
      <form onSubmit={handleConnect} style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input type="email" required placeholder="Connect by email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, background: bg, border: borderStyle, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: text, outline: 'none' }} />
        <button type="submit" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8735F', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>
          <UserPlus size={14} /> Connect
        </button>
      </form>
      {error && <p style={{ fontSize: 11, color: '#E8735F', margin: '-6px 0 12px' }}>{error}</p>}

      {incoming.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: muted, display: 'block', marginBottom: 6 }}>Connection requests</label>
          {incoming.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: bg, border: borderStyle, borderRadius: 8, marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 13, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profiles[r.requester_id] || '…'}</span>
              <button onClick={() => handleAccept(r.id)} aria-label="Accept" title="Accept" style={{ background: '#7FA671', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Check size={14} /></button>
              <button onClick={() => handleRemove(r.id)} aria-label="Decline" title="Decline" style={{ background: 'none', border: borderStyle, color: muted, borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><XIcon size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: muted, display: 'block', marginBottom: 6 }}>Pending</label>
          {outgoing.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: bg, border: borderStyle, borderRadius: 8, marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 13, color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profiles[r.recipient_id] || '…'} — waiting</span>
              <button onClick={() => handleRemove(r.id)} aria-label="Cancel request" title="Cancel request" style={{ background: 'none', border: borderStyle, color: muted, borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><XIcon size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <div>
        <label style={{ fontSize: 12, color: muted, display: 'block', marginBottom: 6 }}>Connected accounts</label>
        {accepted.length === 0 && <p style={{ fontSize: 12, color: muted, margin: 0 }}>No connected accounts yet.</p>}
        {accepted.map((r) => {
          const otherId = r.requester_id === syncUser.id ? r.recipient_id : r.requester_id;
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: bg, border: borderStyle, borderRadius: 8, marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 13, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profiles[otherId] || '…'}</span>
              <button onClick={() => handleRemove(r.id)} aria-label="Remove connection" title="Remove connection" style={{ background: 'none', border: borderStyle, color: muted, borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><XIcon size={14} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
