import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Tarjeta con un encabezado que abre y cierra su contenido en la misma vista. El encabezado es un boton
 * (teclado y lectores de pantalla: `aria-expanded` / `aria-controls`); el contenido solo existe mientras
 * esta abierta, asi que lo que carga datos lo hace al abrirse.
 */
export default function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId().replace(/:/g, '');
  return (
    <section className="card" style={{ marginTop: 14, padding: '4px 18px' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex between"
        style={{ width: '100%', padding: '12px 0', background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left', gap: 12 }}
      >
        <b style={{ fontSize: 14 }}>{title}</b>
        <ChevronDown size={16} aria-hidden="true" style={{ flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && <div id={panelId} role="region" aria-label={title} style={{ paddingBottom: 14 }}>{children}</div>}
    </section>
  );
}
