import { useState, useEffect } from 'react';
import { LogOut, ArrowLeft, ShieldCheck } from 'lucide-react';
import { supabase, supabaseEnabled, setKeepSignedIn } from '../lib/supabaseClient';

const RECOVERY_MODES = ['forgotChoice', 'forgotEmail', 'forgotPassword'];

function errMsg(err) {
  if (!err) return 'Something went wrong.';
  if (typeof err === 'string') return err;
  const msg = err.message || err.error_description || err.msg;
  return msg && msg !== '{}' ? msg : 'Something went wrong — please try again.';
}

export default function AccountPanel({ onUserChange, syncStatus, text, muted, bg, borderStyle, passwordRecovery, onRecoveryHandled, onFocusModeChange, onMfaStatusChange }) {
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

  // Two-factor login challenge (after password is correct but a TOTP code is still required)
  const [mfaPending, setMfaPending] = useState(false);
  const [mfaLoginCode, setMfaLoginCode] = useState('');

  // Two-factor enrollment (managing 2FA from the signed-in Account screen)
  const [mfaFactor, setMfaFactor] = useState(null); // the verified totp factor, if any
  const [mfaSetup, setMfaSetup] = useState(null); // { factorId, qrCode, secret } while enrolling
  const [mfaSetupCode, setMfaSetupCode] = useState('');
  const [mfaError, setMfaError] = useState('');

  useEffect(() => {
    onFocusModeChange?.(passwordRecovery || RECOVERY_MODES.includes(mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passwordRecovery, mode]);

  async function refreshMfaFactors() {
    if (!supabaseEnabled) return;
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp?.find((f) => f.status === 'verified') || null;
    setMfaFactor(factor);
    onMfaStatusChange?.(!!factor);
  }

  useEffect(() => {
    if (!supabaseEnabled) return;
    async function handleSession(session) {
      if (!session) {
        setUser(null);
        setMfaPending(false);
        setMfaFactor(null);
        onMfaStatusChange?.(false);
        onUserChange?.(null);
        return;
      }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
        setMfaPending(true);
        setUser(null);
        onUserChange?.(null);
        return;
      }
      setMfaPending(false);
      setUser(session.user);
      onUserChange?.(session.user);
      refreshMfaFactors();
    }
    supabase.auth.getSession().then(({ data }) => handleSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => handleSession(session));
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
        const { data, error: err } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (err) throw err;
        if (data?.user && data.user.identities?.length === 0) {
          setError('This email already has an account — try logging in instead.');
        } else {
          setInfo('Check your email to confirm your account, then log in.');
        }
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

  async function handleGoogleSignIn() {
    setError('');
    setInfo('');
    setLoading(true);
    setKeepSignedIn(keepSignedInChecked);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (err) throw err;
    } catch (err) {
      setError(errMsg(err));
      setLoading(false);
    }
  }

  async function handleVerifyLoginMfa(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw listErr;
      const totp = factors?.totp?.[0];
      if (!totp) throw new Error('No authenticator app found on this account.');
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId: totp.id, challengeId: challenge.id, code: mfaLoginCode });
      if (vErr) throw vErr;
      setMfaLoginCode('');
      setMfaPending(false);
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
      onUserChange?.(data.session?.user || null);
      refreshMfaFactors();
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

  async function startMfaEnroll() {
    setMfaError('');
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (err) { setMfaError(errMsg(err)); return; }
    setMfaSetup({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmMfaEnroll(e) {
    e.preventDefault();
    setMfaError('');
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: mfaSetup.factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId: mfaSetup.factorId, challengeId: challenge.id, code: mfaSetupCode });
      if (vErr) throw vErr;
      setMfaSetup(null);
      setMfaSetupCode('');
      refreshMfaFactors();
    } catch (err) {
      setMfaError(errMsg(err));
    }
  }

  async function cancelMfaEnroll() {
    if (mfaSetup) await supabase.auth.mfa.unenroll({ factorId: mfaSetup.factorId });
    setMfaSetup(null);
    setMfaSetupCode('');
    setMfaError('');
  }

  async function disableMfa() {
    if (!mfaFactor) return;
    if (!window.confirm('Turn off two-factor authentication?')) return;
    await supabase.auth.mfa.unenroll({ factorId: mfaFactor.id });
    refreshMfaFactors();
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

  if (mfaPending) {
    return (
      <form onSubmit={handleVerifyLoginMfa} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 13, color: text, margin: '0 0 4px' }}>Enter the 6-digit code from your authenticator app</p>
        <input type="text" inputMode="numeric" autoFocus required placeholder="123456" value={mfaLoginCode} onChange={(e) => setMfaLoginCode(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ background: bg, border: borderStyle, borderRadius: 8, padding: '8px 10px', fontSize: 20, letterSpacing: 4, textAlign: 'center', color: text, outline: 'none' }} />
        {error && <p style={{ fontSize: 11, color: '#E8735F', margin: 0 }}>{error}</p>}
        <button type="submit" disabled={loading || mfaLoginCode.length < 6} style={{ background: '#E8735F', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}>
          {loading ? 'Verifying…' : 'Verify'}
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

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: borderStyle }}>
          <p style={{ fontSize: 13, color: text, display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 8px' }}><ShieldCheck size={15} /> Two-factor authentication</p>
          {mfaSetup ? (
            <form onSubmit={confirmMfaEnroll} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 12, color: muted, margin: 0 }}>Scan this in your authenticator app (Google Authenticator, Authy, etc.), or enter the code manually.</p>
              <img src={mfaSetup.qrCode} alt="Two-factor QR code" style={{ width: 160, height: 160, alignSelf: 'center', background: '#fff', borderRadius: 8, padding: 8 }} />
              <p style={{ fontSize: 11, color: muted, textAlign: 'center', wordBreak: 'break-all', margin: 0 }}>{mfaSetup.secret}</p>
              <input type="text" inputMode="numeric" required autoFocus placeholder="Enter 6-digit code" value={mfaSetupCode} onChange={(e) => setMfaSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ background: bg, border: borderStyle, borderRadius: 8, padding: '8px 10px', fontSize: 16, letterSpacing: 2, textAlign: 'center', color: text, outline: 'none' }} />
              {mfaError && <p style={{ fontSize: 11, color: '#E8735F', margin: 0 }}>{mfaError}</p>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={cancelMfaEnroll} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: borderStyle, background: bg, color: text, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={mfaSetupCode.length < 6} style={{ flex: 1, background: '#E8735F', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 10px', fontSize: 13, cursor: 'pointer' }}>Confirm</button>
              </div>
            </form>
          ) : mfaFactor ? (
            <div>
              <p style={{ fontSize: 12, color: '#7FA671', margin: '0 0 8px' }}>Two-factor authentication is on.</p>
              <button onClick={disableMfa} style={{ background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>Turn off</button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: muted, margin: '0 0 8px' }}>Require a code from an authenticator app when signing in.</p>
              {mfaError && <p style={{ fontSize: 11, color: '#E8735F', margin: '0 0 8px' }}>{mfaError}</p>}
              <button onClick={startMfaEnroll} style={{ background: bg, color: text, border: borderStyle, borderRadius: 10, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>Enable two-factor authentication</button>
            </div>
          )}
        </div>
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
      <button type="button" onClick={handleGoogleSignIn} disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: bg, color: text, border: borderStyle, borderRadius: 8, padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}>
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.3 2.7l6-6C33.6 6.5 29.1 4.5 24 4.5 12.9 4.5 4 13.4 4 24.5s8.9 20 20 20 20-8.9 20-20c0-1.4-.1-2.7-.4-4z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13.5 24 13.5c2.8 0 5.3 1 7.3 2.7l6-6C33.6 6.5 29.1 4.5 24 4.5c-7.7 0-14.4 4.4-17.7 10.2z"/>
          <path fill="#4CAF50" d="M24 44.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.6 26.7 36.5 24 36.5c-5.3 0-9.7-3.6-11.3-8.4l-6.5 5C9.5 39.9 16.2 44.5 24 44.5z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.2C40.9 36.4 44 30.9 44 24.5c0-1.4-.1-2.7-.4-4z"/>
        </svg>
        Continue with Google
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: muted, fontSize: 11 }}>
        <div style={{ flex: 1, height: 1, background: muted, opacity: 0.3 }} />
        or
        <div style={{ flex: 1, height: 1, background: muted, opacity: 0.3 }} />
      </div>
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
