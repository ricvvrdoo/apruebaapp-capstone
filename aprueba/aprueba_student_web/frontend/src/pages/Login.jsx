import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { Logo } from '../components/ui.jsx';

export default function Login() {
  const { L, login, social } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('demo@aprueba.cl');
  const [password, setPassword] = useState('demo1234');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const u = await login(email, password); nav(u.onboarded ? '/' : '/onboarding'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const doSocial = async (p) => { setErr(''); try { const u = await social(p); if (u) nav(u.onboarded ? '/' : '/onboarding'); } catch (e) { setErr(e.message); } };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo" style={{ color: 'var(--brand)' }}><Logo size={28} /> Aprueba</div>
        <div className="h" style={{ textAlign: 'center' }}>{L('login_h')}</div>
        <p className="sub" style={{ textAlign: 'center' }}>{L('login_sub')}</p>
        <form onSubmit={submit}>
          <label className="fld">{L('email')}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="fld">{L('password')}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {err && <div className="err">{err}</div>}
          <button className="btn full" style={{ marginTop: 16 }} disabled={busy}>{busy ? L('loading') : L('login_btn')}</button>
        </form>
        <div className="or-sep">{L('co_or').includes('card') ? 'or' : 'o'}</div>
        <button className="paybtn google" onClick={() => doSocial('google')}>{L('social_google')}</button>
        <button className="paybtn apple" onClick={() => doSocial('apple')}>{L('social_apple')}</button>
        <p className="note" style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/forgot" className="muted-link">{L('forgot_link')}</Link>
        </p>
        <p className="note" style={{ textAlign: 'center' }}>
          {L('no_account')} <Link to="/register" className="muted-link">{L('register_link')}</Link>
        </p>
        <p className="note" style={{ textAlign: 'center', marginTop: 10, opacity: .7 }}>
          Demo: demo@aprueba.cl · camila@correo.cl · juan@correo.cl — demo1234
        </p>
      </div>
    </div>
  );
}
