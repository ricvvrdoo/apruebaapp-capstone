import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronRight, Flame, Rocket } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Coin, Bar, Skeleton } from '../components/ui.jsx';

const TIERS = ['bronze', 'silver', 'gold', 'diamond', 'platinum'];

// "5 h 12 min" hasta el reinicio de la cuota (la medianoche del alumno la calcula el servidor).
function untilReset(iso) {
  const mins = Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 60000));
  const h = Math.floor(mins / 60);
  return h ? `${h} h ${mins % 60} min` : `${mins} min`;
}

// Esqueleto con la misma forma que la pantalla: evita el salto de diseno al cargar.
function HomeSkeleton({ label }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <Skeleton h={26} w="38%" />
      <Skeleton h={14} w="24%" style={{ marginTop: 10 }} />
      <div className="dash" style={{ marginTop: 22 }}>
        <div className="card span2"><Skeleton h={22} w="42%" /><Skeleton h={12} w="64%" style={{ marginTop: 12 }} /><Skeleton h={38} w={170} style={{ marginTop: 18 }} /></div>
        <div className="card"><Skeleton h={12} w="35%" /><Skeleton h={30} w="45%" style={{ marginTop: 12 }} /><Skeleton h={12} w="85%" style={{ marginTop: 12 }} /></div>
        <div className="card"><Skeleton h={14} w="45%" /><Skeleton h={10} style={{ marginTop: 16 }} /><Skeleton h={12} w="70%" style={{ marginTop: 14 }} /></div>
        <div className="card span2"><Skeleton h={14} w="30%" /><Skeleton h={44} style={{ marginTop: 16 }} /><Skeleton h={12} w="60%" style={{ marginTop: 14 }} /></div>
        <div className="card span3"><Skeleton h={14} w="30%" /><Skeleton h={40} style={{ marginTop: 16 }} /></div>
      </div>
    </div>
  );
}

// Un fallo parcial (medallas, progreso) solo afecta a su tarjeta y se puede reintentar.
function CardError({ L, onRetry }) {
  return (
    <div role="alert" style={{ textAlign: 'center', padding: '8px 0' }}>
      <p className="note">{L('error_generic')}</p>
      <button type="button" className="btn sec" style={{ marginTop: 8, padding: '8px 12px' }} onClick={onRetry}>{L('retry')}</button>
    </div>
  );
}

export default function Home() {
  const { L, lang } = useAuth();
  const nav = useNavigate();
  const [state, setState] = useState(null);

  const load = useCallback(async () => {
    setState(null);
    // /me y /me/quota son imprescindibles; medallas, progreso y planes degradan solo su tarjeta
    // para que un fallo parcial no deje el dashboard entero en blanco.
    const [me, quota, medals, progress, plans] = await Promise.allSettled([
      api.get('/me'), api.get('/me/quota'), api.get('/me/medals'), api.get('/me/progress'), api.get('/plans'),
    ]);
    if (me.status === 'rejected' || quota.status === 'rejected') { setState({ error: true }); return; }
    setState({
      me: me.value.data,
      quota: quota.value.data,
      medalsFailed: medals.status === 'rejected',
      medals: medals.status === 'fulfilled' ? medals.value.data.wallet : Object.fromEntries(TIERS.map((t) => [t, 0])),
      medalProgress: medals.status === 'fulfilled' ? medals.value.data.progress || {} : {},
      progressFailed: progress.status === 'rejected',
      progress: progress.status === 'fulfilled' ? progress.value.data : [],
      // lastTestId, answeredToday y answeredThisWeek (ver GET /me/progress)
      progressMeta: progress.status === 'fulfilled' ? progress.value.meta || {} : {},
      // precio mensual mas bajo de los planes, para el banner (null si no se pudo leer)
      minPrice: plans.status === 'fulfilled' && plans.value.data.length ? Math.min(...plans.value.data.map((p) => p.price.monthly)) : null,
    });
  }, [lang]); // las etiquetas de las pruebas vienen traducidas del servidor

  useEffect(() => { load(); }, [load]);

  if (!state) return <HomeSkeleton label={L('loading')} />;
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
  const { me, quota, medals, medalsFailed, medalProgress, progress, progressFailed, progressMeta, minPrice } = state;
  const free = me.plan === 'free';

  // Retomar: la ultima prueba que uso el alumno (null si aun no ha respondido nada).
  const lastTestId = progressMeta.lastTestId || null;
  const lastLabel = lastTestId ? (progress.find((p) => p.testId === lastTestId)?.label || lastTestId) : null;
  const left = quota.max - quota.used;
  const continueNote = quota.unlimited ? L('continue_p') : left > 0 ? L('continue_left', { n: left }) : L('continue_out');

  // Nivel que destaca el servidor: el mas bajo que ya se puede canjear o el mas cercano a poder hacerlo.
  const [mTier, mInfo] = Object.entries(medalProgress)[0] || ['bronze', { have: 0, needed: 5, next: 'silver', exchangeable: 0, missing: 5 }];
  const tierName = (t) => L('med_' + t).toLowerCase();
  const exchangeVars = { n: mInfo.exchangeable || mInfo.missing, tier: tierName(mTier), next: tierName(mInfo.next) };
  const medalNote = mInfo.exchangeable > 1 ? L('medals_exchange_many', exchangeVars)
    : mInfo.exchangeable === 1 ? L('medals_exchange_one', exchangeVars)
    : L(mInfo.missing === 1 ? 'medals_missing_one' : 'medals_missing', exchangeVars);

  return (
    <>
      <div style={{ marginBottom: 6 }}>
        <div className="h" style={{ fontSize: 22 }}>{L('greeting')}, {me.name}</div>
        <div className="sub">{L('welcome_sub')}</div>
      </div>
      <div className="dash" style={{ marginTop: 16 }}>
        {/* Una sola accion principal: retomar (o empezar) la practica. */}
        <div className="card span2 hero">
          <div className="h" style={{ color: '#fff', fontSize: 20 }}>{lastLabel ? L('continue_h') : L('continue_new_h')}</div>
          <p className="note">{lastLabel ? continueNote : L('continue_new_p')}</p>
          <button className="btn" style={{ marginTop: 14, alignSelf: 'flex-start' }} onClick={() => nav(lastTestId ? `/practicar?testId=${encodeURIComponent(lastTestId)}` : '/practicar')}>
            {lastLabel ? L('continue_btn', { test: lastLabel }) : L('start_practice')} <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="card stat">
          <span className="lbl"><Flame size={15} aria-hidden="true" /> {L('streak')}</span>
          <span className="big">{me.streak} <span style={{ fontSize: 15, color: 'var(--muted)' }}>{L(me.streak === 1 ? 'day' : 'days')}</span></span>
          <p className="note">{L(me.streakStatus === 'at_risk' && me.streak === 1 ? 'streak_at_risk_one' : `streak_${me.streakStatus || 'none'}`, { n: me.streak })}</p>
        </div>

        <div className="card">
          <div className="flex between"><b>{quota.unlimited ? L('activity_h') : L('quota')}</b><span className="note">{quota.unlimited ? L('unlimited') : `${quota.used} ${L('of')} ${quota.max} ${L('used')}`}</span></div>
          {quota.unlimited ? (
            <div className="flex" style={{ gap: 28, marginTop: 14 }}>
              {[['answeredToday', 'activity_today'], ['answeredThisWeek', 'activity_week']].map(([k, label]) => (
                <div key={k}><div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Montserrat',sans-serif", color: 'var(--brand)' }}>{progressMeta[k] ?? 0}</div><span className="note">{L(label)}</span></div>
              ))}
            </div>
          ) : (
            <>
              <Bar value={(quota.used / quota.max) * 100} label={L('quota')} />
              <p className="note" style={{ marginTop: 8 }}>
                {left > 0 ? L('quota_left', { n: left }) : L('quota_empty')} · {L('quota_resets', { t: untilReset(quota.resetsAt) })}
              </p>
              <p className="note" style={{ marginTop: 2 }}>
                {quota.bonuses?.school && quota.bonuses?.address ? L('quota_bonus_all') : L('quota_bonus_more', { n: (quota.bonuses?.school ? 0 : 5) + (quota.bonuses?.address ? 0 : 5) })}
              </p>
            </>
          )}
        </div>

        <div className="card span2">
          <div className="flex between" style={{ marginBottom: 10 }}>
            <b>{L('medals_title')}</b>
            <button type="button" className="btn gho" style={{ padding: 0, fontSize: 12.5 }} onClick={() => nav('/medallas')}>{L('view_all')} <ChevronRight size={14} aria-hidden="true" /></button>
          </div>
          {medalsFailed ? <CardError L={L} onRetry={load} /> : (
            <>
              <div className="flex between">
                {TIERS.map((t) => (
                  <div key={t} role="group" aria-label={`${L('med_' + t)}: ${medals[t]}`} style={{ textAlign: 'center', opacity: medals[t] > 0 ? 1 : .4 }}>
                    <Coin tier={t} size="md" /><div style={{ fontWeight: 800, fontFamily: "'Montserrat',sans-serif", marginTop: 4 }}>{medals[t]}</div>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <span className="note"><Coin tier={mTier} /> {mInfo.have}/{mInfo.needed} → <Coin tier={mInfo.next} /></span>
              <Bar value={(mInfo.have / mInfo.needed) * 100} color={`var(--${mTier})`} label={L('medals_title')} />
              <p className="note" style={{ marginTop: 6 }}>{medalNote}</p>
              {mInfo.exchangeable > 0 && <button className="btn sec" style={{ marginTop: 8, padding: '8px 12px' }} onClick={() => nav('/medallas')}>{L('medals_go_exchange')}</button>}
            </>
          )}
        </div>

        <div className="card span3">
          <div className="flex between"><b>{L('progress')}</b></div>
          <p className="note" style={{ marginTop: 4 }}>{L('progress_hint')}</p>
          {progressFailed ? <CardError L={L} onRetry={load} /> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 18, marginTop: 12 }}>
              {progress.map((t) => (
                <div key={t.testId}>
                  <div className="flex between"><span style={{ fontSize: 13 }}>{t.label}</span><span className="note">{t.hasData ? `${t.percent}%` : L('progress_no_data')}</span></div>
                  <Bar value={t.hasData ? t.percent : 0} label={t.label} />
                  {!t.hasData && <p className="note" style={{ marginTop: 4 }}>{L('progress_need_more', { n: 5 - t.recent })}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {free && (
          <div className="card span3 upgrade">
            <div className="flex between" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div className="flex" style={{ gap: 14 }}>
                <Rocket size={30} aria-hidden="true" />
                <div><div className="h">{L('upgrade_h')}</div><p className="note">{minPrice != null ? L('upgrade_p', { price: `US$${minPrice}` }) : L('upgrade_p_generic')}</p></div>
              </div>
              <button className="btn" onClick={() => nav('/plan')}>{L('upgrade_cta')}</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
