import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, logout as apiLogout, loadTokens, setTokens, clearTokens } from '../api/frappe';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (token) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const rawRole = data.role || '';
      const mappedRoles = [rawRole];
      if (rawRole === 'teacher' || rawRole === 'instructor') mappedRoles.push('Instructor', 'teacher');
      if (rawRole === 'super_admin' || rawRole === 'principal') mappedRoles.push('Administrator', 'System Manager');
      if (rawRole === 'student') mappedRoles.push('Student');
      if (rawRole === 'parent') mappedRoles.push('Parent');
      
      return {
        name: data.email,
        email: data.email,
        full_name: data.email,
        usr: data.email,
        roles: mappedRoles,
        is_active: data.is_active,
        ...(data.mySection ? { mySection: data.mySection } : {}),
      };
    } catch { return null; }
  };

  const validateSession = useCallback(async () => {
    loadTokens();
    const token = sessionStorage.getItem('erp_access_token');
    if (!token) { setLoading(false); return; }
    const profile = await fetchProfile(token);
    if (profile) {
      setUser(profile);
      setIsAuthenticated(true);
    } else {
      clearTokens();
    }
    setLoading(false);
  }, []);

  useEffect(() => { validateSession(); }, [validateSession]);

  const login = async (usr, pwd) => {
    try {
      const res = await apiLogin(usr, pwd);
      if (res.message === 'Logged In') {
        const profile = await fetchProfile(res.access_token);
        if (profile) {
          setUser(profile);
          setIsAuthenticated(true);
          return true;
        }
      }
      throw new Error('Login failed');
    } catch (err) {
      setIsAuthenticated(false);
      setUser(null);
      clearTokens();
      throw err;
    }
  };

  const logout = async () => {
    try { await apiLogout(); } catch { /* ignore */ }
    clearTokens();
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout, user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
