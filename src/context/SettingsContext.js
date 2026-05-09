// src/context/SettingsContext.js
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@IPTV:settings';

const defaults = {
  playbackMode: 'direct',       // 'direct' | 'proxy'
  autoFallbackToProxy: true,    // auto switch to proxy on direct failure
  // ★ ADD THIS ★
  forceSoftwareDecoder: false,  // false = hardware (ExoPlayer), true = software (MediaPlayer)
};

const SettingsContext = createContext(null);

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(defaults);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw) setSettings({ ...defaults, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const updateSetting = useCallback(async (key, value) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const resetSettings = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setSettings(defaults);
  }, []);

  if (!loaded) return null;

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};