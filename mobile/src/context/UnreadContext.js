import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const UnreadContext = createContext({ totalUnread: 0, unreadByBooking: {}, mark: () => {} });

export function UnreadProvider({ children }) {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadByBooking, setUnreadByBooking] = useState({});
  const intervalRef = useRef(null);

  const fetchUnread = useCallback(async () => {
    try {
      // _silent skips the global "Request failed" toast in the axios interceptor.
      const data = await api.get('/messages/unread-count', { _silent: true });
      if (data && typeof data.total === 'number') {
        setTotalUnread(data.total);
        setUnreadByBooking(data.by_booking || {});
      }
    } catch {
      // 404 or network error — best-effort, keep stale state
    }
  }, []);

  useEffect(() => {
    if (!user) {
      // Pre-login: skip polling, clear stale counts, and stop any running interval.
      setTotalUnread(0);
      setUnreadByBooking({});
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    fetchUnread();
    intervalRef.current = setInterval(fetchUnread, 30000);
    return () => clearInterval(intervalRef.current);
  }, [user, fetchUnread]);

  const mark = useCallback((bookingId) => {
    setUnreadByBooking((prev) => {
      const next = { ...prev };
      const was = next[bookingId] || 0;
      delete next[bookingId];
      setTotalUnread((t) => Math.max(0, t - was));
      return next;
    });
  }, []);

  return (
    <UnreadContext.Provider value={{ totalUnread, unreadByBooking, mark }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  return useContext(UnreadContext);
}
