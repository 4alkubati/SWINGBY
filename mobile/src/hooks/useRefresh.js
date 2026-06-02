// T62 — Standardized pull-to-refresh hook
import { useState, useCallback } from 'react';
import { colors } from '../theme/tokens';

export function useRefresh(fetchFn) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchFn();
    } finally {
      setRefreshing(false);
    }
  }, [fetchFn]);

  const refreshControlProps = {
    refreshing,
    onRefresh,
    tintColor: colors.accent,
    colors: [colors.accent],
    progressBackgroundColor: colors.surface,
  };

  return { refreshing, onRefresh, refreshControlProps };
}
