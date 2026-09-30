import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Toast } from '../components/ui.jsx';

function Switch({ on, onClick }) {
  return (
    <span onClick={onClick} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', width: 42, height: 24, borderRadius: 20, background: on ? 'var(--brand)' : 'var(--line)', position: 'relative', transition: '.2s' }}>
      <span style={{ position: 'absolute', width: 18, height: 18, borderRadius: '50%', background: '#fff', top: 3, left: on ? 21 : 3, transition: '.2s' }} />
    </span>
  );
}

export default function Settings() {
  const { L, user, lang, setLang, dark, toggleTheme, logout } = useAuth();
  const nav = useNavigate();
  const [reminder, setReminder] = useState(true);
  const [tests, setTests] = useState([]);
  const [selected, setSelected] = useState(user?.selectedTests || []);
  const [toast, setToast] = useState('');
  const [delMode, setDelMode] = useState(false);
  const [pwd, setPwd] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  useEffect(() => {
    api.get('/me/settings').then(({ data }) => { setReminder(data.dailyReminder !== false); setSelected(data.selectedTests || []); });
    api.get('/tests').then(({ data }) => setTests(data));
  }, []);

  const toggleReminder = async () => { const v = !reminder; setReminder(v); try { await api.patch('/me/settings', { dailyReminder: v }); flash(L('set_saved')); } catch {} };
  const toggleTest = async (id) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    if (next.length === 0) return;
    setSelected(next);
    try { await api.put('/me/preferences', { selectedTests: next, format: 'random', difficulty: user?.difficulty || 'd2' }); flash(L('set_saved')); } catch (e) { flash(e.message); }
  };
  const exportData = async () => { try { await api.get('/me/data-export'); flash('✓'); } catch {} };
  const deleteAccount = async () => {
    try { await api.del('/me', user.authProvider === 'password' ? { password: pwd } : {}); await logout(); nav('/login'); }
    catch (e) { flash(e.message); }
  };

  const testLabel = (id) => tests.find((t) => t.id === id)?.label || id;

  return (
    <div style={{ maxWidth: 620 }}>
      <Toast msg={toast} />
      <div className="h">{L('set_h')}</div>
      <div className="card" style={{ marginTop: 12, padding: '6px 18px' }}>
        <div className="flex between" style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}><b style={{ fontSize: 13 }}>{L('set_theme')}</b><Switch on={dark} onClick={toggleTheme} /></div>
        <div className="flex between" style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}><b style={{ fontSize: 13 }}>{L('set_lang')}</b>
          <select style={{ width: 'auto', background: 'none', border: 'none', color: 'var(--brand)', fontWeight: 700 }} value={lang} onChange={(e) => setLang(e.target.value)}><option value="es">Español</option><option value="en">English</option></select></div>
        <div className="flex between" style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}><b style={{ fontSize: 13 }}>{L('set_notif')}</b><Switch on={reminder} onClick={toggleReminder} /></div>
        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}><b style={{ fontSize: 13 }}>{L('set_tests')}</b>
          <div className="flex" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {tests.map((t) => <span key={t.id} className="tag" onClick={() => toggleTest(t.id)} style={{ cursor: 'pointer', background: selected.includes(t.id) ? 'var(--brand)' : 'var(--chip)', color: selected.includes(t.id) ? '#fff' : 'var(--muted)' }}>{t.label}</span>)}
          </div>
        </div>
        <div className="flex between" style={{ padding: '12px 0', cursor: 'pointer' }} onClick={() => nav('/plan')}><b style={{ fontSize: 13 }}>{L('set_plan')}</b><span className="note">{user?.plan === 'free' ? L('plan_free') : (user?.plan === 'uni' ? '1 prueba' : 'Todas')} ›</span></div>
      </div>
      <div className="card" style={{ marginTop: 14, cursor: 'pointer' }} onClick={exportData}><div className="flex between"><b style={{ fontSize: 13 }}>{L('set_privacy')}</b><span className="note">›</span></div></div>
      <div className="card" style={{ marginTop: 14, cursor: 'pointer' }} onClick={logout}><div className="flex between"><b style={{ fontSize: 13 }}>{L('set_logout')}</b><span className="note">›</span></div></div>
      <div className="card" style={{ marginTop: 14, borderColor: 'var(--danger)', background: 'rgba(239,68,68,.05)' }}>
        <b style={{ fontSize: 13, color: 'var(--danger)' }}>{L('set_danger')}</b><p className="note">{L('set_danger_p')}</p>
        {delMode ? (
          <>
            {user?.authProvider === 'password' && <input type="password" style={{ marginTop: 10 }} placeholder={L('del_confirm')} value={pwd} onChange={(e) => setPwd(e.target.value)} />}
            <div className="flex" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn sec" onClick={() => setDelMode(false)}>✕</button>
              <button className="btn" style={{ background: 'var(--danger)', color: '#fff' }} onClick={deleteAccount}>{L('set_danger')}</button>
            </div>
          </>
        ) : <button className="btn sec" style={{ marginTop: 10, borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => setDelMode(true)}>{L('set_danger')}</button>}
      </div>
    </div>
  );
}
