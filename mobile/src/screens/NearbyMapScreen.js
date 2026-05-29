// T61 — NearbyMapScreen
// Full-screen MapView centered on user location.
// Custom dark map style matching #07080a bg.
// Business pins with orange dot + initials avatar.
// Tap pin → bottom sheet with card + "View profile" CTA.
// Top-right: category filter modal.
// Offline / map-unavailable fallback via EmptyState.
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { getUserLocation } from '../services/location';
import EmptyState from '../components/EmptyState';
import CategoryScroll from '../components/CategoryScroll';
import { Feather } from '@expo/vector-icons';

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
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#07080a' }] },
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
    stylers: [{ color: '#1a1d1f' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#111315' }],
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
    stylers: [{ color: '#0d0f10' }],
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

function toInitials(name) {
  return (name || '').slice(0, 2).toUpperCase();
}

// ─── Custom pin marker ────────────────────────────────────────────────────────
function BusinessPin({ name }) {
  return (
    <View style={pinStyles.wrapper}>
      <View style={pinStyles.avatar}>
        <Text style={pinStyles.initials}>{toInitials(name)}</Text>
      </View>
      <View style={pinStyles.dot} />
    </View>
  );
}

const pinStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#131618',
    borderWidth: 2,
    borderColor: '#FF5C00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 5,
  },
  initials: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF8C42',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5C00',
    marginTop: 2,
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 3,
  },
});

// ─── Bottom sheet (selected business card) ────────────────────────────────────
function BusinessSheet({ business, onClose, onViewProfile }) {
  if (!business) return null;

  return (
    <View style={sheetStyles.container}>
      <View style={sheetStyles.handle} />
      <View style={sheetStyles.row}>
        <View style={sheetStyles.avatar}>
          <Text style={sheetStyles.initials}>{toInitials(business.business_name)}</Text>
        </View>
        <View style={sheetStyles.info}>
          <Text style={sheetStyles.name} numberOfLines={1}>
            {business.business_name}
          </Text>
          <Text style={sheetStyles.meta}>
            <Text style={sheetStyles.star}>★ {business.avg_rating?.toFixed(1) ?? '—'}</Text>
            {'  ·  '}
            {business.review_count ?? 0} jobs
          </Text>
          {business.category ? (
            <View style={sheetStyles.catPill}>
              <Text style={sheetStyles.catText}>{business.category}</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity
          style={sheetStyles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="x" size={18} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={sheetStyles.ctaBtn} onPress={onViewProfile} activeOpacity={0.85}>
        <Text style={sheetStyles.ctaText}>View profile →</Text>
      </TouchableOpacity>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0d0f10',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#2a2e33',
    padding: 16,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#2a2e33',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#0f2a1a',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  initials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4ade80',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  meta: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  star: {
    color: '#FF5C00',
    fontWeight: '700',
  },
  catPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#131618',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  catText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ctaBtn: {
    backgroundColor: '#FF5C00',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});

// ─── Category filter modal ────────────────────────────────────────────────────
function CategoryModal({ visible, activeCategory, onSelect, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={modalStyles.backdrop} onPress={onClose} activeOpacity={1}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>Filter by category</Text>
          <CategoryScroll activeCategory={activeCategory} onSelect={(c) => { onSelect(c); onClose(); }} prependAll />
          <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={modalStyles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0d0f10',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#2a2e33',
    paddingVertical: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#2a2e33',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  closeBtn: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#131618',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
});

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
      <View style={[styles.container, { paddingTop: insets.top }]}>
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
    <View style={styles.container}>
      {/* ── Full-screen MapView (dominant focal point) ─────────────────── */}
      {loading || !coords ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#FF5C00" size="large" />
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
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
        style={[styles.topBar, { top: insets.top + 12 }]}
        pointerEvents="box-none"
      >
        {/* Back button — top-left */}
        <TouchableOpacity
          style={styles.mapBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={20} color="#ffffff" />
        </TouchableOpacity>

        {/* Filter button — top-right */}
        <TouchableOpacity
          style={[styles.mapBtn, activeCategory !== 'all' && styles.mapBtnActive]}
          onPress={() => setFilterVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather
            name="filter"
            size={18}
            color={activeCategory !== 'all' ? '#FF5C00' : '#ffffff'}
          />
        </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080a',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#07080a',
  },
  // ── Top overlay bar ────────────────────────────────────────────────────────
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mapBtn: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(13,15,16,0.9)',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  mapBtnActive: {
    backgroundColor: 'rgba(255,92,0,0.15)',
    borderColor: '#FF5C00',
  },
});
