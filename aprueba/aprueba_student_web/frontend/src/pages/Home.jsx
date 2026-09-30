import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Coin, Bar, Spinner } from '../components/ui.jsx';

const TIERS = ['bronze', 'silver', 'gold', 'diamond', 'platinum'];

export default function Home() {
  const { L, user } = useAuth();
  const nav = useNavigate();
  const [state, setState] = useState(null);

  useEffect(() => {
    (async () => {
      const [me, quota, medals, progress] = await Promise.all([
        api.get('/me'), api.get('/me/quota'), api.get('/me/medals'), api.get('/me/progress'),
      ]);
      setState({ me: me.data, quota: quota.data, medals: medals.data.wallet, progress: progress.data });
    })().catch(() => setState({ error: true }));
  }, []);

  if (!state) return <Spinner />;
  if (state.error) return <div className="center">{L('retry')}</div>;
  const { me, quota, medals, progress } = state;
  const free = me.plan === 'free';
  const prog = TIERS.find((t) => t !== 'platinum' && medals[t] > 0) || 'bronze';
  const nextT = { bronze: 'silver', silver: 'gold', gold: 'diamond', diamond: 'platinum' }[prog];

  return (
    <>
      <div className="flex between" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
        <div><div className="h" style={{ fontSize: 22 }}>{L('greeting')}, {me.name} {"\u{1F44B}"}</div><div className="sub">{L('welcome_sub')}</div></div>
        <button className="btn" onClick={() => nav('/practicar')}>{L('start_practice')} →</button>
      </div>
      <div className="dash" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="flex between"><b>{L('quota')}</b><span className="note">{quota.unlimited ? L('unlimited') : `${quota.used} ${L('of')} ${quota.max} ${L('used')}`}</span></div>
          <Bar value={quota.unlimited ? 100 : (quota.used / quota.max) * 100} />
          <p className="note" style={{ marginTop: 8 }}>{quota.unlimited ? '∞' : L('quota_note')}</p>
        </div>
        <div className="card stat">
          <span className="lbl">{L('streak')} {"\u{1F525}"}</span>
          <span className="big">{me.streak} <span style={{ fontSize: 15, color: 'var(--muted)' }}>{L('days')}</span></span>
          <p className="note">{L('keep_streak')}</p>
        </div>
        <div className="card">
          <div className="flex between" style={{ marginBottom: 10 }}><b>{L('medals_title')}</b>
            <span className="note" style={{ color: 'var(--brand)', cursor: 'pointer', fontWeight: 700 }} onClick={() => nav('/medallas')}>{L('view_all')} →</span></div>
          <div className="flex between">
            {TIERS.map((t) => (
              <div key={t} style={{ textAlign: 'center', opacity: medals[t] > 0 ? 1 : .4 }}>
                <Coin tier={t} size="md" /><div style={{ fontWeight: 800, fontFamily: "'Montserrat',sans-serif", marginTop: 4 }}>{medals[t]}</div>
              </div>
            ))}
          </div>
          <div className="divider" />
          <span className="note"><Coin tier={prog} /> {medals[prog] % 5}/5 {L('next_tier')} <Coin tier={nextT} /></span>
          <Bar value={(medals[prog] % 5) / 5 * 100} color="var(--bronze)" />
        </div>
        <div className="card span2" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'linear-gradient(135deg,var(--brand),#264b80)', color: '#fff', border: 'none' }}>
          <div className="h" style={{ color: '#fff', fontSize: 20 }}>{L('continue_h')}</div>
          <p className="note" style={{ color: 'rgba(255,255,255,.8)' }}>{L('continue_p')}</p>
          <button className="btn" style={{ marginTop: 14, alignSelf: 'flex-start' }} onClick={() => nav('/practicar')}>{L('start_practice')}</button>
        </div>
        <div className="card">
          <div className="section-label" style={{ margin: '0 0 8px' }}>{L('quick')}</div>
          <div className="row" style={{ marginTop: 6, cursor: 'pointer' }} onClick={() => nav('/practicar')}><span style={{ fontSize: 18 }}>✏️</span> {L('qa_practice')}</div>
          <div className="row" style={{ cursor: 'pointer' }} onClick={() => nav('/grupos')}><span style={{ fontSize: 18 }}>{'\u{1F465}'}</span> {L('qa_groups')}</div>
          <div className="row" style={{ cursor: 'pointer' }} onClick={() => nav('/medallas')}><span style={{ fontSize: 18 }}>{'\u{1F3C5}'}</span> {L('qa_medals')}</div>
        </div>
        <div className="card span3">
          <div className="flex between"><b>{L('progress')}</b></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 18, marginTop: 12 }}>
            {progress.map((t) => (
              <div key={t.testId}><div className="flex between"><span style={{ fontSize: 13 }}>{t.label}</span><span className="note">{t.percent}%</span></div><Bar value={t.percent} /></div>
            ))}
          </div>
        </div>
        {free && (
          <div className="card span3 upgrade">
            <div className="flex between" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div className="flex" style={{ gap: 14 }}><span style={{ fontSize: 32 }}>{'\u{1F680}'}</span><div><div className="h">{L('upgrade_h')}</div><p className="note">{L('upgrade_p')}</p></div></div>
              <button className="btn" onClick={() => nav('/plan')}>{L('upgrade_cta')}</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
