// T60 — useFavorites hook
// Manages favorited business IDs in AsyncStorage.
// Used by FavoritesScreen, NearbyCard, BusinessProfile, etc.
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'swingby_favorites';

export function useFavorites() {
  const [ids, setIds] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setIds(JSON.parse(raw));
        } catch {
          setIds([]);
        }
      }
    });
  }, []);

  const persist = useCallback(async (nextIds) => {
    setIds(nextIds);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextIds));
  }, []);

  const isFavorite = useCallback((id) => ids.includes(id), [ids]);

  const add = useCallback(
    (id) => {
      if (!ids.includes(id)) persist([...ids, id]);
    },
    [ids, persist]
  );

  const remove = useCallback(
    (id) => persist(ids.filter((x) => x !== id)),
    [ids, persist]
  );

  const toggle = useCallback((id) => (ids.includes(id) ? remove(id) : add(id)), [ids, add, remove]);

  return { ids, isFavorite, add, remove, toggle };
}
