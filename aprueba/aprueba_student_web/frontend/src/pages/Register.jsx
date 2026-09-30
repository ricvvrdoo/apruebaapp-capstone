import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { Logo } from '../components/ui.jsx';

export default function Register() {
  const { L, register, social } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', consent: false });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await register(form); nav('/onboarding'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const doSocial = async (p) => { setErr(''); try { const u = await social(p); if (u) nav(u.onboarded ? '/' : '/onboarding'); } catch (e) { setErr(e.message); } };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo"><Logo size={28} /> Aprueba</div>
        <div className="h" style={{ textAlign: 'center' }}>{L('reg_h')}</div>
        <p className="sub" style={{ textAlign: 'center' }}>{L('reg_sub')}</p>
        <form onSubmit={submit}>
          <label className="fld">{L('name')}</label>
          <input value={form.name} onChange={set('name')} required />
          <label className="fld">{L('email')}</label>
          <input type="email" value={form.email} onChange={set('email')} required />
          <label className="fld">{L('password')}</label>
          <input type="password" value={form.password} onChange={set('password')} minLength={8} required />
          <label className="flex" style={{ marginTop: 12, gap: 8, fontSize: 12.5, color: 'var(--muted)' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={form.consent} onChange={set('consent')} /> {L('consent')}
          </label>
          {err && <div className="err">{err}</div>}
          <button className="btn full" style={{ marginTop: 14 }} disabled={busy}>{busy ? L('loading') : L('reg_btn')}</button>
        </form>
        <div className="or-sep">o</div>
        <button className="paybtn google" onClick={() => doSocial('google')}>{L('social_google')}</button>
        <p className="note" style={{ textAlign: 'center', marginTop: 16 }}>
          {L('have_account')} <Link to="/login" className="muted-link">{L('login_link')}</Link>
        </p>
      </div>
    </div>
  );
}
