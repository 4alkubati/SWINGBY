// T61 — NearbyMapScreen  (T60 UX polish)
// Full-screen MapView centered on user location.
// Custom dark map style matching bg token.
// Business pins with accent dot + initials avatar.
// Tap pin → bottom sheet with card + "View profile" CTA.
// Top-right: category filter modal.
// Offline / map-unavailable fallback via EmptyState.
import {
  View,
  Pressable,
  Modal,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import AnimatedRN from 'react-native-reanimated';
import { api } from '../../services/api';
import { getUserLocation } from '../../services/location';
import EmptyState from '../../components/EmptyState';
import CategoryScroll from '../../components/CategoryScroll';
import { SkeletonBox } from '../../components/Skeleton';
import Text from '../../components/Text';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius, shadows, motion } from '../../theme/tokens';

// react-native-maps — already in package.json (v1.20.1)
let MapView, Marker, PROVIDER_GOOGLE;
try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
} catch {
  MapView = null;
  Marker = null;
  PROVIDER_GOOGLE = null;
}

const CALGARY_FALLBACK = { lat: 51.0447, lng: -114.0719 };

// ─── Dark map style — mutes default colors to match app bg ───────────────────
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0c0e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: colors.textSecondary }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: colors.bg }] },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: colors.border }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: colors.border }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#232729' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: colors.surface }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#0a0c0e' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{ color: '#0c0e10' }],
  },
];

// ─── AnimatedPressable for map overlay buttons ────────────────────────────────
const AnimatedPressable = AnimatedRN.createAnimatedComponent(Pressable);

// ─── Custom pin marker ────────────────────────────────────────────────────────
function BusinessPin({ name }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.chip,
          backgroundColor: colors.surfaceAlt,
          borderWidth: 2,
          borderColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.45,
          shadowRadius: 6,
          elevation: 5,
        }}
      >
        <Text
          variant="caption"
          style={{ fontSize: 11, fontWeight: '700', color: colors.accentText }}
        >
          {(name || '').slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: radius.pill,
          backgroundColor: colors.accent,
          marginTop: 2,
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.6,
          shadowRadius: 4,
          elevation: 3,
        }}
      />
    </View>
  );
}

// ─── Bottom sheet (selected business card) ────────────────────────────────────
function BusinessSheet({ business, onClose, onViewProfile }) {
  if (!business) return null;

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.sheet,
        borderTopRightRadius: radius.sheet,
        borderTopWidth: 1,
        borderColor: colors.border,
        padding: spacing.base,
        paddingBottom: spacing.lg + spacing.sm,
        ...shadows.modal,
      }}
    >
      {/* Drag handle */}
      <View
        style={{
          width: 36,
          height: 4,
          backgroundColor: colors.border,
          borderRadius: radius.pill,
          alignSelf: 'center',
          marginBottom: spacing.md + 2,
        }}
      />

      {/* Info row */}
      <Inline spacing="md" align="center" style={{ marginBottom: spacing.md + 2 }}>
        <Avatar name={business.business_name} size="md" />

        <Stack spacing="xs" style={{ flex: 1 }}>
          <Text variant="bodyMedium" numberOfLines={1}>
            {business.business_name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name="star" size={12} color={colors.accentText} strokeWidth={2} />
            <Text variant="smallMedium" style={{ color: colors.accentText }}>
              {business.avg_rating?.toFixed(1) ?? '—'}
            </Text>
            <Text variant="small" color="secondary">
              {`  ·  ${business.review_count ?? 0} jobs`}
            </Text>
          </View>
          {business.category ? (
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.chip,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs - 1,
                marginTop: 2,
              }}
            >
              <Text
                variant="caption"
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  color: colors.textSecondary,
                }}
              >
                {business.category}
              </Text>
            </View>
          ) : null}
        </Stack>

        {/* Close button */}
        <Pressable
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Feather name="x" size={18} color={colors.textSecondary} />
        </Pressable>
      </Inline>

      {/* CTA */}
      <Button variant="primary" label="View profile" onPress={onViewProfile} />
    </View>
  );
}

// ─── Category filter modal ────────────────────────────────────────────────────
function CategoryModal({ visible, activeCategory, onSelect, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'flex-end',
        }}
        onPress={onClose}
      >
        {/* Sheet — stop propagation so tapping inside doesn't dismiss */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingVertical: spacing.base + spacing.xs,
            paddingBottom: spacing.xl + spacing.xs,
          }}
        >
          {/* Handle */}
          <View
            style={{
              width: 36,
              height: 4,
              backgroundColor: colors.border,
              borderRadius: radius.pill,
              alignSelf: 'center',
              marginBottom: spacing.base,
            }}
          />

          {/* Title */}
          <Text
            variant="label"
            style={{
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              color: colors.textSecondary,
              paddingHorizontal: spacing.base,
              marginBottom: spacing.md,
            }}
          >
            Filter by category
          </Text>

          <CategoryScroll
            activeCategory={activeCategory}
            onSelect={(c) => { onSelect(c); onClose(); }}
            prependAll
          />

          {/* Done button */}
          <Button
            variant="secondary"
            label="Done"
            onPress={onClose}
            style={{
              marginHorizontal: spacing.base,
              marginTop: spacing.lg,
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Map overlay button with spring scale micro-interaction ───────────────────
function MapOverlayButton({ onPress, active, children, hitSlop }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={hitSlop}
      style={[
        {
          width: 44,
          height: 44,
          backgroundColor: active ? colors.accentMuted : colors.surface,
          borderWidth: 1,
          borderColor: active ? colors.borderAccent : colors.border,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadows.subtle,
        },
        animatedStyle,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function NearbyMapScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);

  const [mapsAvailable] = useState(() => !!MapView);
  const [coords, setCoords] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [filterVisible, setFilterVisible] = useState(false);

  // Fetch location + businesses on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      let c;
      try { c = await getUserLocation(); }
      catch { c = CALGARY_FALLBACK; }

      if (!cancelled) setCoords(c);

      try {
        const data = await api.get('/businesses/nearby', {
          params: { lat: c.lat, lng: c.lng, radius_km: 25 },
        });
        if (!cancelled) {
          const list = Array.isArray(data) ? data : (data?.businesses ?? []);
          setBusinesses(list);
        }
      } catch {
        // Silently degrade — pins just won't show
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const filteredBusinesses = activeCategory === 'all'
    ? businesses
    : businesses.filter((b) => (b.category ?? '').toLowerCase() === activeCategory);

  const handlePinPress = useCallback((business) => {
    setSelectedBusiness(business);
  }, []);

  const handleSheetClose = useCallback(() => setSelectedBusiness(null), []);

  const handleViewProfile = useCallback(() => {
    if (!selectedBusiness) return;
    setSelectedBusiness(null);
    navigation.navigate('BusinessProfile', { businessId: selectedBusiness.id });
  }, [selectedBusiness, navigation]);

  // ─── Fallback if maps library failed to load ──────────────────────────────
  if (!mapsAvailable) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          paddingTop: insets.top,
        }}
      >
        <EmptyState
          icon="map"
          title="Map unavailable"
          body="Maps could not be loaded on this device"
          action={{ label: 'Back to list', onPress: () => navigation.goBack() }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ── Full-screen MapView (dominant focal point) ─────────────────── */}
      {loading || !coords ? (
        <SkeletonBox
          width="100%"
          height="100%"
          borderRadius={0}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : (
        <MapView
          ref={mapRef}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          provider={PROVIDER_GOOGLE}
          customMapStyle={DARK_MAP_STYLE}
          initialRegion={{
            latitude: coords.lat,
            longitude: coords.lng,
            latitudeDelta: 0.12,
            longitudeDelta: 0.12,
          }}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
        >
          {filteredBusinesses
            .filter((b) => b.lat && b.lng)
            .map((b) => (
              <Marker
                key={b.id}
                coordinate={{ latitude: b.lat, longitude: b.lng }}
                tracksViewChanges={false}
                onPress={() => handlePinPress(b)}
              >
                <BusinessPin name={b.business_name} />
              </Marker>
            ))}
        </MapView>
      )}

      {/* ── Overlay controls ─────────────────────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + spacing.md,
          left: spacing.base,
          right: spacing.base,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        pointerEvents="box-none"
      >
        {/* Back button — top-left */}
        <MapOverlayButton
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </MapOverlayButton>

        {/* Filter button — top-right */}
        <MapOverlayButton
          onPress={() => setFilterVisible(true)}
          active={activeCategory !== 'all'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather
            name="filter"
            size={18}
            strokeWidth={1.8}
            color={activeCategory !== 'all' ? colors.accentText : colors.textPrimary}
          />
        </MapOverlayButton>
      </View>

      {/* ── Business bottom sheet ─────────────────────────────────────────── */}
      <BusinessSheet
        business={selectedBusiness}
        onClose={handleSheetClose}
        onViewProfile={handleViewProfile}
      />

      {/* ── Category filter modal ─────────────────────────────────────────── */}
      <CategoryModal
        visible={filterVisible}
        activeCategory={activeCategory}
        onSelect={setActiveCategory}
        onClose={() => setFilterVisible(false)}
      />
    </View>
  );
}
