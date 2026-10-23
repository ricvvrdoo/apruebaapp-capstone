import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, UserRound } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Skeleton } from '../components/ui.jsx';

function Section({ icon: Icon, title, children }) {
  return (
    <section className="card" style={{ marginTop: 14 }}>
      <div className="flex" style={{ gap: 8, alignItems: 'center' }}><Icon size={18} aria-hidden="true" /><b>{title}</b></div>
      {children}
    </section>
  );
}

// Nombre del grado a partir de su id (los grados vienen agrupados por nivel).
const gradeLabel = (groups, id) => groups.flatMap((g) => g.items || []).find((i) => i.id === id)?.label;

export default function Privacy() {
  const { L } = useAuth();
  const nav = useNavigate();
  const [me, setMe] = useState(null);
  const [country, setCountry] = useState(null);
  const [grade, setGrade] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/me');
        if (cancelled) return;
        setMe(data);
        // Nombres legibles del pais y del grado; si el catalogo no responde se muestran los codigos.
        if (data.country) {
          api.get('/countries').then(({ data: cs }) => !cancelled && setCountry(cs.find((c) => c.code === data.country)?.name)).catch(() => {});
          if (data.gradeId) api.get(`/countries/${data.country}/grades`).then(({ data: gs }) => !cancelled && setGrade(gradeLabel(gs, data.gradeId))).catch(() => {});
        }
      } catch { if (!cancelled) setFailed(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  const empty = L('priv_f_empty');
  const planName = { free: L('plan_free'), uni: L('plan_uni_short'), all: L('plan_all_short') };
  const rows = me && [
    ['priv_f_name', me.name],
    ['priv_f_email', me.email],
    ['priv_f_phone', me.phone ? `${me.phone} (${me.phoneVerified ? L('priv_f_verified') : L('priv_f_unverified')})` : null],
    ['priv_f_country', me.country ? (country || me.country) : null],
    ['priv_f_grade', me.gradeId ? (grade || me.gradeId) : null],
    ['priv_f_school', me.school],
    ['priv_f_age', me.age],
    ['priv_f_region', me.region],
    ['priv_f_lang', me.language === 'en' ? 'English' : 'Español'],
    ['priv_f_tz', me.timezone],
    ['priv_f_plan', planName[me.plan] || me.plan],
  ];

  return (
    <div style={{ maxWidth: 620 }}>
      <div className="h">{L('set_privacy')}</div>
      <p className="note">{L('priv_intro')}</p>

      <Section icon={UserRound} title={L('priv_data_h')}>
        {failed ? <p className="note" style={{ marginTop: 8 }}>{L('error_generic')}</p>
          : !rows ? <div style={{ marginTop: 10, display: 'grid', gap: 10 }}><Skeleton h={18} /><Skeleton h={18} /><Skeleton h={18} /></div>
          : (
            <dl style={{ margin: '10px 0 0', display: 'grid', gap: 0 }}>
              {rows.map(([key, value]) => (
                <div key={key} className="flex between" style={{ padding: '9px 0', borderBottom: '1px solid var(--line)', gap: 16 }}>
                  <dt className="note" style={{ margin: 0 }}>{L(key)}</dt>
                  <dd style={{ margin: 0, fontSize: 13, fontWeight: 600, textAlign: 'right', overflowWrap: 'anywhere', color: value ? 'inherit' : 'var(--muted)' }}>{value || empty}</dd>
                </div>
              ))}
            </dl>
          )}
      </Section>

      <Section icon={Trash2} title={L('priv_delete_h')}>
        <ul className="note" style={{ margin: '8px 0 12px', paddingLeft: 18 }}>
          {['priv_delete_1', 'priv_delete_2', 'priv_delete_3'].map((k) => <li key={k}>{L(k)}</li>)}
        </ul>
        <button className="btn sec" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => nav('/ajustes')}>{L('priv_delete_btn')}</button>
      </Section>
    </div>
  );
}
