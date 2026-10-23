import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Sección que se abre y se cierra en la misma vista. El encabezado es un botón (teclado y lectores de
 * pantalla: `aria-expanded` / `aria-controls`); el contenido solo existe mientras está abierta, así que
 * lo que carga datos lo hace al abrirse.
 */
export default function Accordion({ title, hint, children, last = false }) {
  const [open, setOpen] = useState(false);
  const panelId = useId().replace(/:/g, '');
  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex between"
        style={{ width: '100%', padding: '12px 0', background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left', gap: 12 }}
      >
        <b style={{ fontSize: 13 }}>{title}</b>
        <span className="flex" style={{ gap: 6, alignItems: 'center', minWidth: 0 }}>
          {!open && hint ? <span className="note" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hint}</span> : null}
          <ChevronDown size={16} aria-hidden="true" style={{ flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
        </span>
      </button>
      {open && <div id={panelId} role="region" aria-label={title} style={{ paddingBottom: 14 }}>{children}</div>}
    </div>
  );
}
