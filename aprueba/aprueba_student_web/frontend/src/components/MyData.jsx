import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Skeleton } from './ui.jsx';

// Nombre del grado a partir de su id (los grados vienen agrupados por nivel).
const gradeLabel = (groups, id) => groups.flatMap((g) => g.items || []).find((i) => i.id === id)?.label;

/** Los datos del alumno tal como los guarda la API y lo que pasa con ellos si elimina su cuenta. */
export default function MyData() {
  const { L } = useAuth();
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
    <>
      {failed ? <p className="note">{L('error_generic')}</p>
        : !rows ? <div style={{ display: 'grid', gap: 10 }}><Skeleton h={18} /><Skeleton h={18} /><Skeleton h={18} /></div>
        : (
          <dl style={{ margin: 0 }}>
            {rows.map(([key, value]) => (
              <div key={key} className="flex between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', gap: 16 }}>
                <dt className="note" style={{ margin: 0 }}>{L(key)}</dt>
                <dd style={{ margin: 0, fontSize: 13, fontWeight: 600, textAlign: 'right', overflowWrap: 'anywhere', color: value ? 'inherit' : 'var(--muted)' }}>{value || empty}</dd>
              </div>
            ))}
          </dl>
        )}
      <b style={{ display: 'block', fontSize: 13, marginTop: 14 }}>{L('priv_delete_h')}</b>
      <ul className="note" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
        {['priv_delete_1', 'priv_delete_2', 'priv_delete_3'].map((k) => <li key={k}>{L(k)}</li>)}
      </ul>
    </>
  );
}
