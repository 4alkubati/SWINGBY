// T59 — FavoritesScreen (UX polish)
// Reads favorited IDs from AsyncStorage, fetches each business in parallel,
// renders a list of NearbyCards with an animated heart-remove overlay.
import { View, FlatList, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { show as showToast } from '../services/toast';
import { buttonTap } from '../services/haptics';
import { useFavorites } from '../hooks/useFavorites';
import NearbyCard from '../components/NearbyCard';
import EmptyState from '../components/EmptyState';
import Text from '../components/Text';
import Stack from '../components/Stack';
import Inline from '../components/Inline';
import { SkeletonList } from '../components/Skeleton';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius, shadows, motion } from '../theme/tokens';

// ─── AnimatedPressable ────────────────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function toInitials(name) {
  return (name || '').slice(0, 2).toUpperCase();
}

// ─── HeartButton — spring scale micro-interaction ─────────────────────────────
function HeartButton({ onPress }) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePressIn() {
    scale.value = withSpring(0.95, { stiffness: motion.spring.stiffness, damping: motion.spring.damping });
  }

  function handlePressOut() {
    scale.value = withSpring(1, { stiffness: motion.spring.stiffness, damping: motion.spring.damping });
  }

  async function handlePress() {
    await buttonTap();
    onPress();
  }

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[
        animStyle,
        {
          position: 'absolute',
          top: spacing.sm + 2,
          right: spacing.sm + 2,
          width: 36,
          height: 36,
          backgroundColor: colors.accent + '1F',
          borderWidth: 1,
          borderColor: colors.accent + '4D',
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Feather name="heart" size={18} color={colors.accent} />
    </AnimatedPressable>
  );
}

export default function FavoritesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { ids, remove } = useFavorites();

  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all favorited businesses in parallel whenever the ids list changes
  useEffect(() => {
    if (ids.length === 0) {
      setBusinesses([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all(ids.map((id) => api.get(`/businesses/${id}`)))
      .then((results) => {
        if (!cancelled) {
          // Filter out any nulls in case an id no longer exists
          setBusinesses(results.filter(Boolean));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load favorites');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [ids]);

  const handleRemove = useCallback(
    (id) => {
      remove(id);
      setBusinesses((prev) => prev.filter((b) => b.id !== id));
      showToast({ type: 'info', text1: 'Removed', text2: 'Business removed from favorites' });
    },
    [remove]
  );

  // ─── Header ──────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <Inline
      justify="space-between"
      style={{
        paddingHorizontal: spacing.base,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
      }}
    >
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          width: 40,
          height: 40,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name="arrow-left" size={20} color={colors.textPrimary} />
      </Pressable>

      <Text variant="h2" style={{ flex: 1, textAlign: 'center' }}>
        Favorites
      </Text>

      {/* Spacer to balance the back button */}
      <View style={{ width: 40 }} />
    </Inline>
  );

  // ─── Shared container ─────────────────────────────────────────────────────
  const containerStyle = {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: insets.top,
  };

  // ─── Empty state ─────────────────────────────────────────────────────────
  if (!loading && ids.length === 0) {
    return (
      <Stack style={containerStyle} spacing={0}>
        {renderHeader()}
        <EmptyState
          icon="heart"
          title="No favorites yet"
          body="Tap the heart on any business to save it"
          action={{
            label: 'Browse',
            onPress: () => navigation.navigate('Home'),
          }}
        />
      </Stack>
    );
  }

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Stack style={containerStyle} spacing={0}>
        {renderHeader()}
        <View style={{ paddingHorizontal: spacing.base }}>
          <SkeletonList count={5} />
        </View>
      </Stack>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Stack style={containerStyle} spacing={0}>
        {renderHeader()}
        <EmptyState
          icon="wifi-off"
          title="Couldn't load favorites"
          body={error}
          action={{
            label: 'Retry',
            onPress: () => setError(null), // triggers re-render → useEffect re-runs
          }}
        />
      </Stack>
    );
  }

  // ─── Results list ─────────────────────────────────────────────────────────
  return (
    <View style={containerStyle}>
      {renderHeader()}
      <FlatList
        data={businesses}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
          paddingBottom: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <View style={{ position: 'relative' }}>
            <NearbyCard
              name={item.business_name}
              initials={toInitials(item.business_name)}
              rating={item.avg_rating?.toFixed(1) ?? '—'}
              jobs={item.review_count ?? 0}
              distance={item._distance ?? '—'}
              avatarStyle={index % 2 === 0 ? 'green' : 'blue'}
              onPress={() =>
                navigation.navigate('BusinessProfile', { businessId: item.id })
              }
            />
            {/* Heart remove button — animated spring scale */}
            <HeartButton onPress={() => handleRemove(item.id)} />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm + 2 }} />}
        ListEmptyComponent={
          <EmptyState
            icon="heart"
            title="No favorites yet"
            body="Tap the heart on any business to save it"
            action={{ label: 'Browse', onPress: () => navigation.navigate('Home') }}
          />
        }
      />
    </View>
  );
}
