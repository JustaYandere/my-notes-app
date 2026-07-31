import { useState, useEffect } from 'react';
import { LogOut, ArrowLeft } from 'lucide-react';
import { supabase, supabaseEnabled, setKeepSignedIn } from '../lib/supabaseClient';

const RECOVERY_MODES = ['forgotChoice', 'forgotEmail', 'forgotPassword'];

function errMsg(err) {
  if (!err) return 'Something went wrong.';
  if (typeof err === 'string') return err;
  return err.message || err.error_description || err.msg || 'Something went wrong.';
}

export default function AccountPanel({ onUserChange, syncStatus, text, muted, bg, borderStyle, passwordRecovery, onRecoveryHandled, onFocusModeChange }) {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [keepSignedInChecked, setKeepSignedInChecked] = useState(true);

  useEffect(() => {
    onFocusModeChange?.(passwordRecovery || RECOVERY_MODES.includes(mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passwordRecovery, mode]);

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

  async function handleForgotPassword(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (err) throw err;
      setInfo('Check your email for a link to reset your password.');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSetNewPassword(e) {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) { setError('Passwords do not match.'); return; }
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) throw err;
      await supabase.auth.signOut();
      setNewPassword('');
      setNewPasswordConfirm('');
      setMode('login');
      setInfo('Password updated — log in with your new password.');
      onRecoveryHandled?.();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    setKeepSignedIn(keepSignedInChecked);
    try {
      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (err) throw err;
        setInfo('Check your email to confirm your account, then log in.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  }

  function backToLogin() {
    setError('');
    setInfo('');
    setMode('login');
  }

  if (!supabaseEnabled) {
    return <p style={{ fontSize: 12, color: muted, margin: 0 }}>Cloud sync isn't configured yet.</p>;
  }

  if (passwordRecovery) {
    return (
      <form onSubmit={handleSetNewPassword} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 13, color: text, margin: '0 0 4px' }}>Choose a new password</p>
        <input type="password" required placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} style={{ background: bg, border: borderStyle, borderRadius: 8, padding: '8px 10px', fontSize: 16, color: text, outline: 'none' }} />
        <input type="password" required placeholder="Confirm new password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} minLength={6} style={{ background: bg, border: borderStyle, borderRadius: 8, padding: '8px 10px', fontSize: 16, color: text, outline: 'none' }} />
        {error && <p style={{ fontSize: 11, color: '#E8735F', margin: 0 }}>{error}</p>}
        {info && <p style={{ fontSize: 11, color: '#7FA671', margin: 0 }}>{info}</p>}
        <button type="submit" disabled={loading} style={{ background: '#E8735F', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}>
          {loading ? 'Please wait…' : 'Update password'}
        </button>
      </form>
    );
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

  if (mode === 'forgotChoice') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" onClick={backToLogin} style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', background: 'none', border: 'none', color: muted, fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 4 }}>
          <ArrowLeft size={13} /> Back to log in
        </button>
        <p style={{ fontSize: 13, color: text, margin: '0 0 4px' }}>What did you forget?</p>
        <button type="button" onClick={() => { setMode('forgotPassword'); setError(''); setInfo(''); }} style={{ padding: '9px 12px', borderRadius: 8, border: borderStyle, background: bg, color: text, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
          My password
        </button>
        <button type="button" onClick={() => { setMode('forgotEmail'); setError(''); setInfo(''); }} style={{ padding: '9px 12px', borderRadius: 8, border: borderStyle, background: bg, color: text, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
          The email I signed up with
        </button>
      </div>
    );
  }

  if (mode === 'forgotEmail') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" onClick={() => setMode('forgotChoice')} style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', background: 'none', border: 'none', color: muted, fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 4 }}>
          <ArrowLeft size={13} /> Back
        </button>
        <p style={{ fontSize: 13, color: text, margin: 0 }}>
          If you're still signed in on another device or browser, open <strong>Settings → Account</strong> there — it shows the email you're signed in with at the top.
        </p>
        <p style={{ fontSize: 12, color: muted, margin: 0 }}>
          If you're not signed in anywhere else, there isn't a way to look up the email from inside the app — contact support at the email listed in the app's privacy policy for help.
        </p>
      </div>
    );
  }

  if (mode === 'forgotPassword') {
    return (
      <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" onClick={() => setMode('forgotChoice')} style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', background: 'none', border: 'none', color: muted, fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 4 }}>
          <ArrowLeft size={13} /> Back
        </button>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ background: bg, border: borderStyle, borderRadius: 8, padding: '8px 10px', fontSize: 16, color: text, outline: 'none' }} />
        {error && <p style={{ fontSize: 11, color: '#E8735F', margin: 0 }}>{error}</p>}
        {info && <p style={{ fontSize: 11, color: '#7FA671', margin: 0 }}>{info}</p>}
        <button type="submit" disabled={loading} style={{ background: '#E8735F', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}>
          {loading ? 'Please wait…' : 'Send reset link'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        <button type="button" onClick={() => setMode('login')} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: mode === 'login' ? '2px solid #E8735F' : borderStyle, background: bg, color: text, fontSize: 12, cursor: 'pointer' }}>Log in</button>
        <button type="button" onClick={() => setMode('signup')} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: mode === 'signup' ? '2px solid #E8735F' : borderStyle, background: bg, color: text, fontSize: 12, cursor: 'pointer' }}>Sign up</button>
      </div>
      <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ background: bg, border: borderStyle, borderRadius: 8, padding: '8px 10px', fontSize: 16, color: text, outline: 'none' }} />
      <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} style={{ background: bg, border: borderStyle, borderRadius: 8, padding: '8px 10px', fontSize: 16, color: text, outline: 'none' }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: text, cursor: 'pointer' }}>
        <input type="checkbox" checked={keepSignedInChecked} onChange={(e) => setKeepSignedInChecked(e.target.checked)} />
        Keep me signed in
      </label>
      {mode === 'login' && (
        <button type="button" onClick={() => { setMode('forgotChoice'); setError(''); setInfo(''); }} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: muted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
          Forgot password or email?
        </button>
      )}
      {error && <p style={{ fontSize: 11, color: '#E8735F', margin: 0 }}>{error}</p>}
      {info && <p style={{ fontSize: 11, color: '#7FA671', margin: 0 }}>{info}</p>}
      <button type="submit" disabled={loading} style={{ background: '#E8735F', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}>
        {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
      </button>
    </form>
  );
}
