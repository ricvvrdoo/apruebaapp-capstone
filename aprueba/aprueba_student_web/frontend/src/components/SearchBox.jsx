import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

// Buscador de la barra superior: grupos del alumno y pruebas (GET /search).
// Patron combobox: se opera con flechas, Enter y Escape.
export default function SearchBox() {
  const { L } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]); // [{ key, group, label, sub, to }]
  const [status, setStatus] = useState('idle'); // idle|loading|done|error
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef(null);
  const seq = useRef(0); // descarta respuestas de busquedas ya superadas

  useEffect(() => {
    const text = q.trim();
    if (text.length < MIN_CHARS) { seq.current++; setItems([]); setStatus('idle'); return undefined; }
    const mine = ++seq.current;
    setStatus('loading');
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(text)}&types=groups,topics&limit=5`);
        if (mine !== seq.current) return;
        setItems([
          ...data.groups.map((g) => ({ key: `g:${g.id}`, group: 'search_groups', label: g.name, sub: g.subject, to: `/grupos?id=${encodeURIComponent(g.id)}` })),
          ...data.topics.map((t2) => ({ key: `t:${t2.testId}`, group: 'search_topics', label: t2.label, sub: '', to: `/practicar?testId=${encodeURIComponent(t2.testId)}` })),
        ]);
        setActive(-1); setStatus('done');
      } catch {
        if (mine === seq.current) { setItems([]); setStatus('error'); }
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  // Cierra al hacer clic fuera.
  useEffect(() => {
    const onDoc = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const go = (item) => { nav(item.to); setQ(''); setItems([]); setOpen(false); };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) setOpen(true);
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? items.length - 1 : i - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); go(items[active]); }
  };

  const showPanel = open && q.trim().length >= MIN_CHARS;
  let lastGroup = null;
  return (
    <div className="search" ref={box}>
      <input
        role="combobox" aria-expanded={showPanel} aria-controls="search-list" aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `search-opt-${active}` : undefined}
        aria-label={L('search_ph')} placeholder={L('search_ph')} autoComplete="off"
        value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
      />
      {showPanel && (
        <ul id="search-list" className="search-panel" role="listbox">
          {status === 'loading' && !items.length && <li className="search-msg" role="presentation">{L('loading')}</li>}
          {status === 'error' && <li className="search-msg" role="presentation">{L('search_error')}</li>}
          {status === 'done' && !items.length && <li className="search-msg" role="presentation">{L('search_none')}</li>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? <li key={`h-${it.group}`} className="search-head" role="presentation">{L(it.group)}</li> : null;
            lastGroup = it.group;
            return (
              <React.Fragment key={it.key}>
                {head}
                <li
                  id={`search-opt-${i}`} role="option" aria-selected={i === active}
                  className={`search-opt ${i === active ? 'on' : ''}`}
                  onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); go(it); }}
                >
                  <span>{it.label}</span>{it.sub ? <span className="note"> · {it.sub}</span> : null}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
}
