import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setTokens, clearTokens, hasSession, setAuthFailHandler } from '../api/client.js';
import { makeL } from '../i18n.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [lang, setLang] = useState(localStorage.getItem('aprueba_lang') || 'es');
  const [dark, setDark] = useState(localStorage.getItem('aprueba_dark') === '1');
  const [loading, setLoading] = useState(true);
  const L = makeL(lang);

  useEffect(() => { document.body.classList.toggle('dark', dark); localStorage.setItem('aprueba_dark', dark ? '1' : '0'); }, [dark]);
  useEffect(() => { document.documentElement.lang = lang; localStorage.setItem('aprueba_lang', lang); }, [lang]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout', {}); } catch {}
    clearTokens(); setUser(null);
  }, []);

  useEffect(() => { setAuthFailHandler(() => setUser(null)); }, []);

  const loadMe = useCallback(async () => {
    if (!hasSession()) { setLoading(false); return; }
    try {
      const { data } = await api.get('/me');
      setUser(data);
      // sincroniza preferencias de presentacion
      try { const s = (await api.get('/me/settings')).data; if (s.locale) setLang(s.locale); if (s.theme) setDark(s.theme === 'dark'); data.onboarded = (s.selectedTests || []).length > 0; setUser({ ...data }); } catch {}
    } catch { clearTokens(); setUser(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  const afterAuth = useCallback(async (payload) => {
    setTokens(payload.accessToken, payload.refreshToken);
    let onboarded = false;
    try { const s = (await api.get('/me/settings')).data; onboarded = (s.selectedTests || []).length > 0; if (s.locale) setLang(s.locale); if (s.theme) setDark(s.theme === 'dark'); } catch {}
    const me = (await api.get('/me')).data;
    setUser({ ...me, onboarded });
    return { ...me, onboarded };
  }, []);

  const login = async (email, password) => afterAuth((await api.post('/auth/login', { email, password })).data);
  const register = async (body) => afterAuth((await api.post('/auth/register', body)).data);
  const social = async (provider) => {
    // Demo: simula un idToken "provider:email:nombre".
    const email = prompt(`Demo ${provider}: ingresa un correo`); if (!email) return null;
    const idToken = `${provider}:${email}:${email.split('@')[0]}`;
    return afterAuth((await api.post('/auth/social', { provider, idToken })).data);
  };

  const refreshUser = useCallback(async () => { try { const me = (await api.get('/me')).data; setUser((u) => ({ ...u, ...me })); return me; } catch {} }, []);

  const toggleTheme = async () => { const v = !dark; setDark(v); try { await api.patch('/me/settings', { theme: v ? 'dark' : 'light' }); } catch {} };
  const changeLang = async (l) => { setLang(l); try { await api.patch('/me/settings', { locale: l }); } catch {} };

  return (
    <Ctx.Provider value={{ user, setUser, lang, setLang: changeLang, dark, toggleTheme, L, loading, login, register, social, logout, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
}
