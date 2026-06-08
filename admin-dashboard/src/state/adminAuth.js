import React from 'react';
import { createAdminApi } from './adminApi.js';

export const AuthContext = React.createContext(null);


const TOKEN_KEY = 'cec_admin_token';

export function AdminAuthProvider({ children }) {
  const [token, setToken] = React.useState(null);
  const [me, setMe] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const api = React.useMemo(() => createAdminApi(() => token), [token]);

  async function init() {
    setLoading(true);
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      if (!t) {
        setToken(null);
        setMe(null);
        return;
      }
      setToken(t);
      const res = await api.get('/api/admin/me');
      setMe(res.me || null);
    } catch {
      // Token might be expired.
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  async function login({ username, password }) {
    // Use the API instance to perform login; then explicitly use the returned token
    // when fetching /me to avoid state-update races.
    const res = await api.post('/api/admin/login', { username, password });
    if (!res?.token) throw new Error(res?.error || 'Login failed');

    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);

    // Create a one-off api bound to the freshly returned token
    const immediateApi = createAdminApi(() => res.token);
    const meRes = await immediateApi.get('/api/admin/me');
    setMe(meRes.me || null);
  }


  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setMe(null);
  }

  return (
    React.createElement(
      AuthContext.Provider,
      { value: { token, me, loading, init, login, logout, api } },
      children
    )
  );
}


export function useAdminAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}

export function AdminAuthProviderWrapper({ children }) {
  return React.createElement(AdminAuthProvider, null, children);
}




