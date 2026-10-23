import React from 'react';

const EMOJI = { bronze: '\u{1F949}', silver: '\u{1F948}', gold: '\u{1F947}', diamond: '\u{1F48E}', platinum: '⬢' };
const SIZE = { sm: 'm-sm', md: 'm-md', lg: 'm-lg' };

export function Coin({ tier, size = 'sm' }) {
  return <span className={`medal-coin ${tier} ${SIZE[size] || 'm-sm'}`}>{EMOJI[tier] || '\u{1F3C5}'}</span>;
}

// Barra de progreso. `label` es el nombre que anuncia un lector de pantalla ("Cuota diaria, 50 %").
export function Bar({ value, color, label }) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}>
      <i style={{ width: `${v}%`, ...(color ? { background: color } : {}) }} />
    </div>
  );
}

export function Spinner() { return <div className="center"><div className="spin" /></div>; }

export function Toast({ msg }) { return msg ? <div className="toast">{msg}</div> : null; }

export function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'E';
}

export function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <polygon points="3,27 9,6 13,6 8,27" fill="currentColor" />
      <polygon points="27,27 21,6 17,6 22,27" fill="currentColor" />
      <rect x="7" y="14" width="16" height="4" rx="1" fill="currentColor" />
      <rect x="12" y="14" width="6" height="10" rx="1" fill="#F5B041" />
      <polygon points="15,5 12,10 18,10" fill="#F5B041" />
    </svg>
  );
}

// Opcion seleccionable (respuesta, prueba). Se opera con teclado: Tab para
// llegar, Enter o Espacio para elegir. Sin onSelect queda solo de lectura.
export function Opt({ selected = false, state = '', onSelect, role = 'radio', children, style }) {
  const interactive = !!onSelect;
  const onKeyDown = (e) => {
    if (!interactive) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
  };
  return (
    <div
      className={`opt ${selected ? 'sel' : ''} ${state}`.trim()}
      style={style}
      role={interactive ? role : undefined}
      aria-checked={interactive ? selected : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}

// Puntaje 0-4 de la contraseña: largo, mayuscula, numero y simbolo.
export function passwordScore(pw = '') {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

// Campo de contrasena con boton para ver/ocultar y, opcional, indicador de fuerza.
export function PasswordInput({ value, onChange, L, showStrength = false, invalid = false, autoComplete, id, ...rest }) {
  const [shown, setShown] = React.useState(false);
  const score = passwordScore(value);
  return (
    <>
      <div style={{ position: 'relative' }}>
        <input
          id={id} type={shown ? 'text' : 'password'} value={value} onChange={onChange}
          autoComplete={autoComplete} aria-invalid={invalid || undefined}
          style={{ paddingRight: 64 }} {...rest}
        />
        <button
          type="button" className="btn gho" onClick={() => setShown((v) => !v)}
          aria-label={shown ? L('pw_hide') : L('pw_show')} aria-pressed={shown}
          style={{ position: 'absolute', right: 4, top: 4, padding: '6px 10px', fontSize: 12 }}
        >
          {shown ? L('pw_hide') : L('pw_show')}
        </button>
      </div>
      {showStrength && value ? (
        <div className="pw-meter" aria-live="polite">
          <div className="pw-bars">{[1, 2, 3, 4].map((n) => <i key={n} className={n <= score ? `on s${score}` : ''} />)}</div>
          <span className="note">{L('pw_strength_' + score)}</span>
        </div>
      ) : null}
    </>
  );
}

// Mensaje de error de un campo, enlazado con aria-describedby.
export function FieldError({ id, children }) {
  return children ? <div id={id} className="field-err" role="alert">{children}</div> : null;
}

// Bloque gris animado mientras llega el contenido.
export function Skeleton({ h = 16, w = '100%', style }) {
  return <div className="skel" aria-hidden="true" style={{ height: h, width: w, ...style }} />;
}

export function SkeletonCards({ n = 3, h = 110 }) {
  return (
    <div role="status" aria-busy="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="card" style={{ marginTop: 16 }}>
          <Skeleton h={14} w="40%" /><Skeleton h={h - 40} style={{ marginTop: 12 }} />
        </div>
      ))}
    </div>
  );
}

// Aviso global: cualquier modulo llama notify('texto') y el Layout lo muestra.
export function notify(msg) { window.dispatchEvent(new CustomEvent('aprueba:toast', { detail: String(msg) })); }

export function ToastHost() {
  const [msg, setMsg] = React.useState('');
  React.useEffect(() => {
    let t;
    const on = (e) => { setMsg(e.detail); clearTimeout(t); t = setTimeout(() => setMsg(''), 3000); };
    window.addEventListener('aprueba:toast', on);
    return () => { window.removeEventListener('aprueba:toast', on); clearTimeout(t); };
  }, []);
  return msg ? <div className="toast" role="status" aria-live="polite">{msg}</div> : null;
}
