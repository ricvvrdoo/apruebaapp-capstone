import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Coin, Bar, Spinner } from '../components/ui.jsx';

const TIERS = ['bronze', 'silver', 'gold', 'diamond', 'platinum'];

// "5 h 12 min" hasta el reinicio de la cuota (la medianoche del alumno la calcula el servidor).
function untilReset(iso) {
  const mins = Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 60000));
  const h = Math.floor(mins / 60);
  return h ? `${h} h ${mins % 60} min` : `${mins} min`;
}

export default function Home() {
  const { L, user, lang } = useAuth();
  const nav = useNavigate();
  const [state, setState] = useState(null);

  const load = useCallback(async () => {
    setState(null);
    // /me y /me/quota son imprescindibles; medallas y progreso degradan a vacio
    // para que un fallo parcial no deje el dashboard entero en blanco.
    const [me, quota, medals, progress] = await Promise.allSettled([
      api.get('/me'), api.get('/me/quota'), api.get('/me/medals'), api.get('/me/progress'),
    ]);
    if (me.status === 'rejected' || quota.status === 'rejected') { setState({ error: true }); return; }
    setState({
      me: me.value.data,
      quota: quota.value.data,
      medals: medals.status === 'fulfilled' ? medals.value.data.wallet : Object.fromEntries(TIERS.map((t) => [t, 0])),
      medalProgress: medals.status === 'fulfilled' ? medals.value.data.progress || {} : {},
      progress: progress.status === 'fulfilled' ? progress.value.data : [],
    });
  }, [lang]); // las etiquetas de las pruebas vienen traducidas del servidor

  useEffect(() => { load(); }, [load]);

  if (!state) return <Spinner />;
  if (state.error) {
    return (
      <div className="center">
        <div style={{ textAlign: 'center' }}>
          <p className="note" style={{ marginBottom: 10 }}>{L('error_generic')}</p>
          <button className="btn sec" onClick={load}>{L('retry')}</button>
        </div>
      </div>
    );
  }
  const { me, quota, medals, medalProgress, progress } = state;
  const free = me.plan === 'free';
  // Nivel que destaca el servidor: el mas bajo que ya se puede canjear o el mas cercano a poder hacerlo.
  const [mTier, mInfo] = Object.entries(medalProgress)[0] || ['bronze', { have: 0, needed: 5, next: 'silver', exchangeable: 0, missing: 5 }];
  const tierName = (t) => L('med_' + t).toLowerCase();
  const exchangeVars = { n: mInfo.exchangeable || mInfo.missing, tier: tierName(mTier), next: tierName(mInfo.next) };
  const medalNote = mInfo.exchangeable > 1 ? L('medals_exchange_many', exchangeVars)
    : mInfo.exchangeable === 1 ? L('medals_exchange_one', exchangeVars)
    : L(mInfo.missing === 1 ? 'medals_missing_one' : 'medals_missing', exchangeVars);

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
          {quota.unlimited ? <p className="note" style={{ marginTop: 8 }}>∞</p> : (
            <>
              <p className="note" style={{ marginTop: 8 }}>
                {quota.max - quota.used > 0 ? L('quota_left', { n: quota.max - quota.used }) : L('quota_empty')} · {L('quota_resets', { t: untilReset(quota.resetsAt) })}
              </p>
              <p className="note" style={{ marginTop: 2 }}>
                {quota.bonuses?.school && quota.bonuses?.address ? L('quota_bonus_all') : L('quota_bonus_more', { n: (quota.bonuses?.school ? 0 : 5) + (quota.bonuses?.address ? 0 : 5) })}
              </p>
            </>
          )}
        </div>
        <div className="card stat">
          <span className="lbl">{L('streak')} {"\u{1F525}"}</span>
          <span className="big">{me.streak} <span style={{ fontSize: 15, color: 'var(--muted)' }}>{L(me.streak === 1 ? 'day' : 'days')}</span></span>
          <p className="note">{L(me.streakStatus === 'at_risk' && me.streak === 1 ? 'streak_at_risk_one' : `streak_${me.streakStatus || 'none'}`, { n: me.streak })}</p>
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
          <span className="note"><Coin tier={mTier} /> {mInfo.have}/{mInfo.needed} → <Coin tier={mInfo.next} /></span>
          <Bar value={(mInfo.have / mInfo.needed) * 100} color={`var(--${mTier})`} />
          <p className="note" style={{ marginTop: 6 }}>{medalNote}</p>
          {mInfo.exchangeable > 0 && <button className="btn sec" style={{ marginTop: 8, padding: '8px 12px' }} onClick={() => nav('/medallas')}>{L('medals_go_exchange')}</button>}
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
          <p className="note" style={{ marginTop: 4 }}>{L('progress_hint')}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 18, marginTop: 12 }}>
            {progress.map((t) => (
              <div key={t.testId}>
                <div className="flex between"><span style={{ fontSize: 13 }}>{t.label}</span><span className="note">{t.hasData ? `${t.percent}%` : L('progress_no_data')}</span></div>
                <Bar value={t.hasData ? t.percent : 0} />
                {!t.hasData && <p className="note" style={{ marginTop: 4 }}>{L('progress_need_more', { n: 5 - t.recent })}</p>}
              </div>
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
