import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('accrediguard_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accrediguard_token');
    if (!token) { setLoading(false); return; }
    api.get('/auth/me')
      .then((res) => { setUser(res.data.data); localStorage.setItem('accrediguard_user', JSON.stringify(res.data.data)); })
      .catch(() => { localStorage.removeItem('accrediguard_token'); localStorage.removeItem('accrediguard_user'); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('accrediguard_token', res.data.data.token);
    localStorage.setItem('accrediguard_user', JSON.stringify(res.data.data.user));
    setUser(res.data.data.user);
    return res.data.data.user;
  }

  async function register(name, email, password) {
    // Public self-registration always creates a STUDENT account on the
    // backend, regardless of what's sent here — see authController.js.
    const res = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('accrediguard_token', res.data.data.token);
    localStorage.setItem('accrediguard_user', JSON.stringify(res.data.data.user));
    setUser(res.data.data.user);
    return res.data.data.user;
  }

  function updateUser(nextUser) {
    setUser(nextUser);
    localStorage.setItem('accrediguard_user', JSON.stringify(nextUser));
  }

  function logout() {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('accrediguard_token');
    localStorage.removeItem('accrediguard_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
