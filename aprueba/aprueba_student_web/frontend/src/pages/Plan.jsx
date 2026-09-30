import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Spinner } from '../components/ui.jsx';

export default function Plan() {
  const { L, user, refreshUser } = useAuth();
  const nav = useNavigate();
  const [view, setView] = useState('loading'); // loading|paywall|checkout|success|manage
  const [plans, setPlans] = useState([]);
  const [sub, setSub] = useState(null);
  const [billing, setBilling] = useState('yearly');
  const [chosen, setChosen] = useState(null);
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);

  const init = async () => {
    const [pl, s] = await Promise.all([api.get('/plans'), api.get('/me/subscription')]);
    setPlans(pl.data); setSub(s.data);
    if (s.data && s.data.status === 'active' && user.plan !== 'free') { setBilling(s.data.billingCycle); setView('manage'); }
    else setView('paywall');
  };
  useEffect(() => { init().catch(() => setView('paywall')); }, []);

  const price = (p) => billing === 'yearly' ? p.price.yearly : p.price.monthly;
  const goCheckout = (p) => { setChosen(p); setView('checkout'); };

  const pay = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/checkout/sessions', { plan: chosen.id, billingCycle: billing });
      setSession(data);
      await api.post(`/checkout/sessions/${data.checkoutSessionId}/confirm`, {});
      await refreshUser();
      setView('success');
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  const changePlan = () => setView('paywall');
  const cancel = async () => { try { const { data } = await api.post('/me/subscription/cancel', { immediate: false }); setSub({ ...sub, cancelAtPeriodEnd: true }); } catch (e) { alert(e.message); } };

  if (view === 'loading') return <Spinner />;

  if (view === 'manage') {
    const planName = plans.find((p) => p.id === user.plan)?.name || user.plan;
    return (
      <div style={{ maxWidth: 640 }}>
        <div className="h">{L('plan_h')}</div>
        <div className="card" style={{ marginTop: 12 }}>
          <div className="flex between"><b>{L('plan_current')}</b><span className="tag g">{planName}</span></div>
          <div className="divider" />
          <div className="flex between"><span className="note">{L('co_cycle')}</span><span className="note">{sub?.billingCycle === 'yearly' ? L('bill_yr') : L('bill_mo')}</span></div>
          <div className="flex between" style={{ marginTop: 8 }}><span className="note">{L('mng_next')}</span><span className="note">{sub?.currentPeriodEnd}</span></div>
          <div className="flex between" style={{ marginTop: 8 }}><span className="note">{L('mng_method')}</span><span className="note">{'\u{1F4B3}'} •••• {sub?.paymentMethod?.last4 || '4242'}</span></div>
        </div>
        {sub?.cancelAtPeriodEnd && <div className="card flat" style={{ marginTop: 12, borderColor: 'var(--oro)' }}><p className="note" style={{ margin: 0, color: '#B45309' }}>⏳ {L('mng_cancelled')}</p></div>}
        <div className="flex" style={{ gap: 10, marginTop: 14 }}>
          <button className="btn sec" onClick={changePlan}>{L('mng_change')}</button>
          {!sub?.cancelAtPeriodEnd && <button className="btn gho" style={{ color: 'var(--danger)' }} onClick={cancel}>{L('mng_cancel')}</button>}
        </div>
      </div>
    );
  }

  if (view === 'success') {
    return (
      <div style={{ maxWidth: 520, margin: '30px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 60 }}>{'\u{1F389}'}</div>
        <div className="h" style={{ color: 'var(--accent)' }}>{L('pay_ok_h')}</div><p className="p">{L('pay_ok_p')}</p>
        <div className="card" style={{ textAlign: 'left', marginTop: 16, borderColor: 'var(--accent)' }}>
          <div className="flex between"><span className="note">{L('co_plan')}</span><b>{chosen?.name}</b></div>
          <div className="flex between" style={{ marginTop: 8 }}><span className="note">{L('co_total')}</span><b>${session?.amount} {session?.currency}</b></div>
        </div>
        <button className="btn full" style={{ marginTop: 16 }} onClick={() => nav('/')}>{L('pay_go')}</button>
      </div>
    );
  }

  if (view === 'checkout') {
    const amount = price(chosen);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start', maxWidth: 860 }}>
        <div className="card">
          <div className="section-label" style={{ margin: '0 0 8px' }}>{L('co_summary')}</div>
          <div className="flex between"><span className="note">{L('co_plan')}</span><b>{chosen.name}</b></div><div className="divider" />
          <div className="flex between"><span className="note">{L('co_cycle')}</span><b>{billing === 'yearly' ? `${L('bill_yr')} · ${L('bill_save')}` : L('bill_mo')}</b></div><div className="divider" />
          <div className="flex between"><b>{L('co_total')}</b><span className="price" style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)' }}>${amount}{billing === 'yearly' ? L('yr') : L('mo')}</span></div>
          <p className="note" style={{ marginTop: 8 }}>{billing === 'yearly' ? L('co_billed_yr') : L('co_billed_mo')}</p>
          <button className="btn gho" style={{ marginTop: 6, paddingLeft: 0 }} onClick={() => setView('paywall')}>← {L('co_back')}</button>
        </div>
        <div className="card">
          <div className="section-label" style={{ margin: '0 0 8px' }}>{L('co_fast')}</div>
          <button className="paybtn apple" onClick={pay} disabled={busy}>Pay</button>
          <button className="paybtn google" onClick={pay} disabled={busy}><b>Google</b> Pay</button>
          <div className="or-sep">{L('co_or')}</div>
          <input placeholder={L('co_card_num')} defaultValue="4242 4242 4242 4242" />
          <div className="flex" style={{ gap: 8, marginTop: 9 }}><input placeholder={L('co_exp')} defaultValue="12 / 28" /><input placeholder={L('co_cvc')} defaultValue="123" /></div>
          <input style={{ marginTop: 9 }} placeholder={L('co_name')} defaultValue={user.name} />
          <input style={{ marginTop: 9 }} placeholder={L('co_email')} defaultValue={user.email} />
          <button className="btn full" style={{ marginTop: 12 }} onClick={pay} disabled={busy}>{busy ? L('loading') : `${L('co_pay')} $${amount}`}</button>
          <div className="note" style={{ textAlign: 'center', marginTop: 10 }}>{'\u{1F512}'} {L('co_secure')}</div>
        </div>
      </div>
    );
  }

  // paywall
  return (
    <div style={{ maxWidth: 760 }}>
      <div className="h">{L('cap_h')}</div><p className="p">{L('cap_p')}</p>
      <div className="seg" style={{ marginTop: 10 }}>
        <div className={billing === 'monthly' ? 'on' : ''} onClick={() => setBilling('monthly')}>{L('bill_mo')}</div>
        <div className={billing === 'yearly' ? 'on' : ''} onClick={() => setBilling('yearly')}>{L('bill_yr')} · {L('bill_save')}</div>
      </div>
      <div className="plan-grid">
        {plans.map((p) => (
          <div key={p.id} className="card" style={p.popular ? { border: '2px solid var(--brand)' } : {}}>
            <div className="flex between"><b>{p.name}</b>{p.popular ? <span className="tag g">{L('popular')}</span> : null}</div>
            <div className="price" style={{ fontSize: 30, fontWeight: 800, color: 'var(--brand)', margin: '8px 0' }}>${price(p)}<small style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>{billing === 'yearly' ? L('yr') : L('mo')}</small></div>
            {(p.features || []).map((f, i) => <p key={i} className="note">✓ {f}</p>)}
            <button className={`btn ${p.popular ? '' : 'sec'} full`} style={{ marginTop: 12 }} onClick={() => goCheckout(p)}>{L('choose')}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
