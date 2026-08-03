import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

const POLL_INTERVAL_MS = 30000;

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  const authHeader = () => {
    const token = sessionStorage.getItem('erp_access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/unread-count', { headers: authHeader() });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unread_count ?? 0);
    } catch {
      /* ignore — keep last known count rather than flashing to 0 */
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=20', { headers: authHeader() });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH', headers: authHeader() });
    } catch {
      /* optimistic update already applied; a failed background sync isn't worth surfacing */
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await fetch('/api/notifications/read-all', { method: 'POST', headers: authHeader() });
    } catch {
      /* same as above */
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    fetchUnreadCount();
    pollRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isAuthenticated, fetchUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);