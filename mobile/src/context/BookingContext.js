import { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../services/api';

const BookingContext = createContext(null);

export function BookingProvider({ children }) {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get('/bookings/');
      setBookings(data?.items || data || []);
    } catch {
      // keep stale data on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  const activeBookings = bookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'in_progress'
  );
  const pastBookings = bookings.filter(
    (b) => b.status === 'completed' || b.status === 'cancelled'
  );

  return (
    <BookingContext.Provider value={{ bookings, activeBookings, pastBookings, isLoading, refresh }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBookings() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBookings must be inside BookingProvider');
  return ctx;
}
