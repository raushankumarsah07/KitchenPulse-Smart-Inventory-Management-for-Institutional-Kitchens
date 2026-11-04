import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('kp_token'));

  const logout = useCallback(() => { localStorage.removeItem('kp_token'); setUser(null); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);
  useEffect(() => {
    if (!localStorage.getItem('kp_token')) return;
    api.get('/auth/me').then((r) => setUser(r.user)).catch(logout).finally(() => setLoading(false));
  }, [logout]);

  const finish = (r) => { localStorage.setItem('kp_token', r.token); setUser(r.user); };
  const value = useMemo(() => ({
    user, loading, logout,
    login: async (email, password) => finish(await api.post('/auth/login', { email, password })),
    register: async (name, email, password) => finish(await api.post('/auth/register', { name, email, password })),
  }), [user, loading, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
