import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const SettingsContext = createContext(null);

const DEFAULTS = {
  academic_year: '',
  company: '',
  school_name: '',
  school_email: '',
  school_phone: '',
  school_address: '',
  currency: 'INR',
  loading: true,
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/academic/years');
      const years = await res.json();
      const activeYear = Array.isArray(years) ? years.find(y => y.is_active) || years[0] : null;
      setSettings({
        academic_year: activeYear?.name || '',
        company: 'School ERP',
        school_name: 'School ERP',
        school_email: '',
        school_phone: '',
        school_address: '',
        currency: 'INR',
        loading: false,
      });
    } catch {
      setSettings({ ...DEFAULTS, loading: false });
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  return (
    <SettingsContext.Provider value={{ ...settings, reload: loadSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
