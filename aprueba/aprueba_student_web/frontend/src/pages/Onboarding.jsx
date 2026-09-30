import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Logo, Spinner } from '../components/ui.jsx';

export default function Onboarding() {
  const { L, user, setUser } = useAuth();
  const nav = useNavigate();
  const [tests, setTests] = useState(null);
  const [selected, setSelected] = useState([]);
  const [format, setFormat] = useState('random');
  const [difficulty, setDifficulty] = useState('d2');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const paid = user?.plan && user.plan !== 'free';

  useEffect(() => { api.get('/tests').then(({ data }) => setTests(data)).catch(() => setTests([])); }, []);
  const toggle = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const finish = async () => {
    setErr('');
    if (selected.length === 0) { setErr(L('empty_q')); return; }
    setBusy(true);
    try {
      await api.put('/me/preferences', { selectedTests: selected, format, difficulty });
      setUser({ ...user, onboarded: true });
      nav('/');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!tests) return <Spinner />;
  return (
    <div className="auth-wrap" style={{ alignItems: 'flex-start', paddingTop: 40 }}>
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <div className="auth-logo"><Logo size={28} /> Aprueba</div>
        <div className="h">{L('ob_h')}</div>
        <p className="sub">{L('ob_sub')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          {tests.map((t) => (
            <div key={t.id} onClick={() => toggle(t.id)} className={`opt ${selected.includes(t.id) ? 'sel' : ''}`} style={{ marginTop: 0 }}>
              <span className="k" style={selected.includes(t.id) ? { background: t.color, color: '#fff', borderColor: t.color } : {}}>✓</span>
              {t.label}
            </div>
          ))}
        </div>

        <div className="section-label">{L('ob_format')}</div>
        <div className="seg">
          <div className={format === 'random' ? 'on' : ''} onClick={() => setFormat('random')}>{L('ob_random')}</div>
          <div className={format === 'facsim' ? 'on' : ''} onClick={() => paid && setFormat('facsim')} style={!paid ? { opacity: .5 } : {}}>{L('ob_facsim')}</div>
        </div>
        {!paid && <p className="note" style={{ marginTop: 6 }}>{L('ob_facsim_note')}</p>}

        <div className="section-label">{L('ob_difficulty')}</div>
        <div className="seg" style={{ flexWrap: 'wrap' }}>
          {['d1', 'd2', 'd3', 'd4'].map((d) => (
            <div key={d} className={difficulty === d ? 'on' : ''} onClick={() => setDifficulty(d)}>{L('ob_' + d)}</div>
          ))}
        </div>

        {err && <div className="err">{err}</div>}
        <button className="btn full" style={{ marginTop: 18 }} disabled={busy} onClick={finish}>{busy ? L('loading') : L('ob_finish')}</button>
      </div>
    </div>
  );
}
