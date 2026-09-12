import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from './api';
import { useAuth } from './AuthContext.jsx';

const SettingsContext = createContext(null);

const DEFAULTS = { institution_name: 'Tukuza SIS', currency_symbol: 'K', currency_code: 'ZMW' };

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULTS);

  const refresh = useCallback(() => {
    if (!user) return;
    api.get('/settings').then((res) => setSettings(res.data)).catch(() => {});
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <SettingsContext.Provider value={{ settings, refreshSettings: refresh }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext) || { settings: DEFAULTS, refreshSettings: () => {} };
}

export function useCurrency() {
  const { settings } = useSettings();
  return settings.currency_symbol || 'K';
}
