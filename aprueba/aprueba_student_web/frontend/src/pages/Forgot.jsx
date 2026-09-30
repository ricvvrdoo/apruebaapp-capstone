import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Logo } from '../components/ui.jsx';

export default function Forgot() {
  const { L } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await api.post('/auth/password/forgot', { email }); setSent(true); } catch {} finally { setBusy(false); } };
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo"><Logo size={28} /> Aprueba</div>
        <div className="h" style={{ textAlign: 'center' }}>{L('forgot_h')}</div>
        <p className="sub" style={{ textAlign: 'center' }}>{L('forgot_sub')}</p>
        {sent ? <div className="okmsg">{L('forgot_sent')}</div> : (
          <form onSubmit={submit}>
            <label className="fld">{L('email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button className="btn full" style={{ marginTop: 14 }} disabled={busy}>{busy ? L('loading') : L('forgot_btn')}</button>
          </form>
        )}
        <p className="note" style={{ textAlign: 'center', marginTop: 16 }}><Link to="/login" className="muted-link">{L('back_login')}</Link></p>
      </div>
    </div>
  );
}
