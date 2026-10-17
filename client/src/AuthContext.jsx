import React, { createContext, useContext, useState, useCallback } from 'react';
import api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('tukuza_user');
    return raw ? JSON.parse(raw) : null;
  });

  const [mustChangePassword, setMustChangePassword] = useState(
    () => localStorage.getItem('tukuza_must_change_pw') === '1'
  );

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('tukuza_token', data.token);
    localStorage.setItem('tukuza_user', JSON.stringify(data.user));
    if (data.mustChangePassword) localStorage.setItem('tukuza_must_change_pw', '1');
    else localStorage.removeItem('tukuza_must_change_pw');
    setMustChangePassword(!!data.mustChangePassword);
    setUser(data.user);
    return data.user;
  }, []);

  const clearMustChangePassword = useCallback(() => {
    localStorage.removeItem('tukuza_must_change_pw');
    setMustChangePassword(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('tukuza_token');
    localStorage.removeItem('tukuza_user');
    localStorage.removeItem('tukuza_must_change_pw');
    setMustChangePassword(false);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, mustChangePassword, clearMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
