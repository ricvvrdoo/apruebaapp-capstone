import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { notify } from '../components/ui.jsx';

// Descarga `data` como un archivo .json (sin pasar por el servidor: la API ya lo entrego completo).
function saveJson(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="card" style={{ marginTop: 14 }}>
      <div className="flex" style={{ gap: 8, alignItems: 'center' }}><Icon size={18} aria-hidden="true" /><b>{title}</b></div>
      {children}
    </section>
  );
}

export default function Privacy() {
  const { L } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const { data } = await api.get('/me/data-export');
      saveJson(data, `aprueba-mis-datos-${new Date().toISOString().slice(0, 10)}.json`);
      notify(L('priv_downloaded'));
    } catch (e) { notify(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 620 }}>
      <div className="h">{L('set_privacy')}</div>
      <p className="note">{L('priv_intro')}</p>

      <Section icon={ShieldCheck} title={L('priv_stored_h')}>
        <ul className="note" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
          {['priv_stored_1', 'priv_stored_2', 'priv_stored_3', 'priv_stored_4'].map((k) => <li key={k}>{L(k)}</li>)}
        </ul>
      </Section>

      <Section icon={Download} title={L('priv_download_h')}>
        <p className="note" style={{ margin: '8px 0 12px' }}>{L('priv_download_p')}</p>
        <button className="btn" onClick={download} disabled={busy} aria-busy={busy}>
          <Download size={16} aria-hidden="true" /> {busy ? L('priv_downloading') : L('priv_download_btn')}
        </button>
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
