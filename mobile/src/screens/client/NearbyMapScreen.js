// NearbyMapScreen — walkthrough item D10.
//
// Full-screen map centred on the caller, real Google tiles where they can be
// drawn and the app's own styled canvas where they cannot. Chrome is shared
// between the two so the screen looks identical either way: 40px back circle
// + glass-lite category pill on top, an always-up result sheet at the bottom,
// and a category filter modal.
import {
  View,
  Pressable,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import AnimatedRN from 'react-native-reanimated';
import { api } from '../../services/api';
import { getUserLocation } from '../../services/location';
import CategoryScroll, { CATEGORIES } from '../../components/CategoryScroll';
import { MapCanvas, MapDot, MapAvatarPin } from '../../components/MapPreviewCard';
import Text from '../../components/Text';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import BusinessLogo from '../../components/BusinessLogo';
import Inline from '../../components/Inline';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius, shadows, motion } from '../../theme/tokens';

// react-native-maps — already in package.json (v1.20.1). Which provider draws
// (Apple on iOS, Google on Android) and the null-safe lazy require both live in
// services/maps.js so this screen and ProviderLiveLocation cannot disagree.
import { MapView, Marker, MAP_PROVIDER, darkMapProps } from '../../services/maps';

const CALGARY_FALLBACK = { lat: 51.0447, lng: -114.0719 };

// ─── D10: the styled map ─────────────────────────────────────────────────────
// Kira: the map was "bare purple/green dots", and it "needs a bit of SaaS to
// it". The `Nearby Map` frame in SwingBy All Screens.dc.html does not draw a
// Google map at all — it draws the app's own surface: the mapBg gradient, a
// faint 34px grid, 14px pins with soft rings (one green for the top-rated
// pro), a glass-lite location pill, and a result sheet that is always up.
//
// This is also what renders when react-native-maps cannot draw — the Huawei
// in the walkthrough has no Play Services. That device failure is not being
// chased; the point is that the screen is designed instead of dead when the
// tile layer is missing.

// Project real coordinates into 8–92% of the canvas. Pure geometry over the
// same `businesses` array the screen already fetched — no extra request.
function projectPins(list, centre) {
  const pts = list.filter((b) => typeof b.lat === 'number' && typeof b.lng === 'number');
  if (!pts.length) return [];
  const lats = pts.map((b) => b.lat).concat(centre ? [centre.lat] : []);
  const lngs = pts.map((b) => b.lng).concat(centre ? [centre.lng] : []);
  const minLat = Math.min(...lats); const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs);
  const spanLat = maxLat - minLat || 0.01;
  const spanLng = maxLng - minLng || 0.01;
  return pts.map((b) => ({
    business: b,
    // y inverts: north is up.
    x: 8 + ((b.lng - minLng) / spanLng) * 84,
    y: 8 + ((maxLat - b.lat) / spanLat) * 84,
  }));
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toInitials(name) {
  return (name || '').replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean)
    .map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '??';
}

// ─── Dark map style — mutes default colors to match app bg ───────────────────
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: colors.mapBgTop }] },
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
    stylers: [{ color: colors.surfaceAlt }],
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
    stylers: [{ color: colors.mapBgTop }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{ color: colors.mapBgMid }],
  },
];

// ─── AnimatedPressable for map overlay buttons ────────────────────────────────
const AnimatedPressable = AnimatedRN.createAnimatedComponent(Pressable);

// ─── Custom pin marker ────────────────────────────────────────────────────────
// Marker for the real map. Unselected pins are the frame's 14px dot with a
// soft ring — one green for the top-rated pro. The selected pin is the 44px
// initials circle. Every pin used to be an identical purple tile-plus-dot,
// which is what read as "bare dots".
function BusinessPin({ name, top = false, selected = false }) {
  const color = top ? colors.success : colors.accent;
  const ring = top ? colors.successRing : colors.accentRing;

  if (selected) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', width: 56, height: 56 }}>
        <View style={pinStyles.avatar}>
          <Text style={pinStyles.avatarText}>
            {(name || '').slice(0, 2).toUpperCase()}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 34, height: 34 }}>
      <View style={[pinStyles.ring, { backgroundColor: ring }]} />
      <View style={[pinStyles.dot, { backgroundColor: color }]} />
    </View>
  );
}

const pinStyles = StyleSheet.create({
  ring: { position: 'absolute', width: 30, height: 30, borderRadius: 15 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: colors.textPrimary },
});

// ─── Result sheet ────────────────────────────────────────────────────────────
// The frame keeps this sheet UP at all times: drag handle, an "N PROS NEAR
// YOU" eyebrow, then the selected business (or the top-rated one when nothing
// is selected) as a 48px tile / name + Verified pill / rating meta / View
// button. Previously the screen was a bare map until you found and hit a pin.
function ResultSheet({ business, count, onViewProfile, onClose, selected }) {
  const rating = business?.avg_rating != null ? Number(business.avg_rating).toFixed(1) : null;
  const meta = [
    business?.review_count != null ? `${business.review_count} jobs` : null,
    business?.distanceLabel || null,
  ].filter(Boolean).join(' · ');

  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHandle} />

      <Inline justify="space-between" style={{ alignItems: 'center' }}>
        <Text variant="label" color="secondary">
          {`${count} ${count === 1 ? 'pro' : 'pros'} near you`}
        </Text>
        {selected ? (
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Clear selection"
          >
            <Feather name="x" size={16} strokeWidth={1.8} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </Inline>

      {business ? (
        <View style={styles.sheetRow}>
          <BusinessLogo uri={business.logo_url} name={business.business_name} size={48} />

          <View style={styles.sheetText}>
            <Inline spacing="sm" style={{ alignItems: 'center' }}>
              <Text variant="smallMedium" style={styles.sheetName} numberOfLines={1}>
                {business.business_name}
              </Text>
              {business.license_status === 'verified' ? (
                <View style={styles.verifiedPill}>
                  <Text style={styles.verifiedPillText}>Verified</Text>
                </View>
              ) : null}
            </Inline>
            <View style={styles.sheetMeta}>
              {rating ? (
                <>
                  <Feather name="star" size={12} strokeWidth={2} color={colors.textPrimary} />
                  <Text variant="smallMedium" style={{ fontSize: 13 }}>{rating}</Text>
                </>
              ) : null}
              {meta ? (
                <Text variant="small" color="secondary" style={{ fontSize: 13 }} numberOfLines={1}>
                  {rating ? ` · ${meta}` : meta}
                </Text>
              ) : null}
            </View>
          </View>

          <Button label="View" onPress={onViewProfile} style={styles.sheetCta} />
        </View>
      ) : (
        <View style={styles.sheetEmpty}>
          <Text variant="smallMedium">No pros in this area yet</Text>
          <Text variant="small" color="secondary" style={{ textAlign: 'center' }}>
            Try a wider category filter, or post a job and let them come to you.
          </Text>
        </View>
      )}
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
          const list = Array.isArray(data) ? data : (data?.items ?? []);
          // Distance for the sheet's meta line. Same response, same request —
          // the backend already returns distance_km on /nearby; the local
          // haversine is only the fallback for a row without it.
          setBusinesses(list.map((b) => ({
            ...b,
            distanceLabel:
              typeof b.distance_km === 'number'
                ? `${b.distance_km.toFixed(1)} km`
                : (typeof b.lat === 'number' && typeof b.lng === 'number'
                  ? `${haversineKm(c.lat, c.lng, b.lat, b.lng).toFixed(1)} km`
                  : null),
          })));
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

  // Top-rated pin gets the green treatment (the frame marks exactly one).
  const topRatedId = filteredBusinesses.length
    ? filteredBusinesses.reduce(
      (best, b) => ((b.avg_rating ?? 0) > (best.avg_rating ?? 0) ? b : best),
      filteredBusinesses[0],
    ).id
    : null;

  // Sheet subject: the pin you tapped, else the top-rated pro. The frame never
  // shows an empty sheet.
  const sheetBusiness = selectedBusiness
    || filteredBusinesses.find((b) => b.id === topRatedId)
    || filteredBusinesses[0]
    || null;

  const pins = projectPins(filteredBusinesses, coords);

  const areaLabel = business_areaLabel(filteredBusinesses.length, activeCategory);

  // ─── Chrome shared by the real map and the styled canvas ──────────────────
  const chrome = (
    <>
      {/* Top bar — 40px back circle + glass-lite location pill, per the frame. */}
      <View
        style={[styles.topBar, { top: insets.top + spacing.md }]}
        pointerEvents="box-none"
      >
        <MapOverlayButton
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={19} strokeWidth={1.8} color={colors.textPrimary} />
        </MapOverlayButton>

        <Pressable
          onPress={() => setFilterVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Filter by category. ${areaLabel}`}
          style={({ pressed }) => [styles.locationPill, pressed && { opacity: 0.9 }]}
        >
          <Text variant="smallMedium" style={{ fontSize: 13.5 }} numberOfLines={1}>
            {areaLabel}
          </Text>
          <Feather
            name="chevron-down"
            size={15}
            strokeWidth={1.8}
            color={activeCategory !== 'all' ? colors.accentText : colors.textSecondary}
          />
        </Pressable>
      </View>

      <ResultSheet
        business={sheetBusiness}
        count={filteredBusinesses.length}
        selected={!!selectedBusiness}
        onClose={handleSheetClose}
        onViewProfile={handleViewProfile}
      />

      <CategoryModal
        visible={filterVisible}
        activeCategory={activeCategory}
        onSelect={setActiveCategory}
        onClose={() => setFilterVisible(false)}
      />
    </>
  );

  // ─── Styled canvas ────────────────────────────────────────────────────────
  // Used when react-native-maps is not drawable (no Play Services on the
  // walkthrough device, no Maps API key in this build). The screen stays the
  // designed surface instead of an "unavailable" dead end.
  if (!mapsAvailable) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <MapCanvas style={StyleSheet.absoluteFill}>
          {pins.map((p) => (
            <MapDot
              key={p.business.id}
              x={p.x}
              y={p.y}
              top={p.business.id === topRatedId}
              live={p.business.id === sheetBusiness?.id}
            />
          ))}
          {sheetBusiness && pins.some((p) => p.business.id === sheetBusiness.id) ? (
            (() => {
              const sel = pins.find((p) => p.business.id === sheetBusiness.id);
              return (
                <MapAvatarPin
                  x={sel.x}
                  y={sel.y}
                  initials={toInitials(sheetBusiness.business_name)}
                  onPress={handleViewProfile}
                />
              );
            })()
          ) : null}
        </MapCanvas>
        {loading ? (
          <View style={styles.canvasLoading} pointerEvents="none">
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null}
        {chrome}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ── Full-screen MapView (dominant focal point) ─────────────────── */}
      {loading || !coords ? (
        <MapCanvas style={StyleSheet.absoluteFill} />
      ) : (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={MAP_PROVIDER}
          {...darkMapProps(DARK_MAP_STYLE)}
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
                <BusinessPin
                  name={b.business_name}
                  top={b.id === topRatedId}
                  selected={b.id === selectedBusiness?.id}
                />
              </Marker>
            ))}
        </MapView>
      )}

      {chrome}
    </View>
  );
}

// Header pill copy: category filter first (it is what the pill controls),
// otherwise the count of what is on screen.
function business_areaLabel(count, activeCategory) {
  if (activeCategory && activeCategory !== 'all') {
    const label = CATEGORIES.find((c) => c.id === activeCategory)?.label;
    if (label) return `${label} · ${count} nearby`;
  }
  return `All categories · ${count} nearby`;
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  locationPill: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.overlayScrim,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
  },

  canvasLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Result sheet ──
  sheet: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 30,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: spacing.md,
    // §3 — an overlapping sheet is one of the two places a shadow is allowed.
    ...shadows.card,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 6,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  sheetText: { flex: 1, minWidth: 0, gap: 3 },
  sheetName: { flexShrink: 1, fontSize: 15.5 },
  sheetMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sheetCta: { flexShrink: 0, minHeight: 42, paddingVertical: 0, paddingHorizontal: 18 },
  sheetEmpty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },

  verifiedPill: {
    backgroundColor: colors.successTint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  verifiedPillText: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: colors.success },
});
