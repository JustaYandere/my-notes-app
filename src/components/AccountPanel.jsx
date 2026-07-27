import { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { supabase, supabaseEnabled } from '../lib/supabaseClient';

export default function AccountPanel({ onUserChange, syncStatus, text, muted, bg, borderStyle }) {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (!supabaseEnabled) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      onUserChange?.(data.session?.user || null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      onUserChange?.(session?.user || null);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setInfo('Check your email to confirm your account, then log in.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  }

  if (!supabaseEnabled) {
    return <p style={{ fontSize: 12, color: muted, margin: 0 }}>Cloud sync isn't configured yet.</p>;
  }

  if (user) {
    const statusLabel = syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'error' ? 'Sync error' : 'Synced';
    const statusColor = syncStatus === 'error' ? '#E8735F' : syncStatus === 'syncing' ? muted : '#7FA671';
    return (
      <div>
        <p style={{ fontSize: 13, color: text, margin: '0 0 4px' }}>Signed in as <strong>{user.email}</strong></p>
        <p style={{ fontSize: 12, color: statusColor, margin: '0 0 8px' }}>{statusLabel}</p>
        <button onClick={handleSignOut} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        <button type="button" onClick={() => setMode('login')} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: mode === 'login' ? '2px solid #E8735F' : borderStyle, background: bg, color: text, fontSize: 12, cursor: 'pointer' }}>Log in</button>
        <button type="button" onClick={() => setMode('signup')} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: mode === 'signup' ? '2px solid #E8735F' : borderStyle, background: bg, color: text, fontSize: 12, cursor: 'pointer' }}>Sign up</button>
      </div>
      <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ background: bg, border: borderStyle, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: text, outline: 'none' }} />
      <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} style={{ background: bg, border: borderStyle, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: text, outline: 'none' }} />
      {error && <p style={{ fontSize: 11, color: '#E8735F', margin: 0 }}>{error}</p>}
      {info && <p style={{ fontSize: 11, color: '#7FA671', margin: 0 }}>{info}</p>}
      <button type="submit" disabled={loading} style={{ background: '#E8735F', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}>
        {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
      </button>
    </form>
  );
}
