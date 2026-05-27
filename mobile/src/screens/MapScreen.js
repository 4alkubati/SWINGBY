import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import MapView, { Marker, Callout } from 'react-native-maps';
import { getCurrentLocation } from '../services/location';
import { api } from '../services/api';

const CALGARY_DEFAULT = { latitude: 51.0447, longitude: -114.0719, latitudeDelta: 0.15, longitudeDelta: 0.15 };

export default function MapScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [location, setLocation] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const loc = await getCurrentLocation();
        setLocation(loc);
        if (loc) {
          const data = await api.get(
            `/businesses/nearby?lat=${loc.lat}&lng=${loc.lng}&radius_km=25`
          );
          setBusinesses(data || []);
        }
      } catch (err) {
        Alert.alert('Location error', 'Could not get your location. Showing Calgary.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const region = location
    ? { latitude: location.lat, longitude: location.lng, latitudeDelta: 0.1, longitudeDelta: 0.1 }
    : CALGARY_DEFAULT;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← List view</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nearby</Text>
        <View style={{ width: 80 }} />
      </View>

      {loading ? (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator color="#FF5C00" size="large" />
        </View>
      ) : (
        <MapView
          style={styles.map}
          initialRegion={region}
          showsUserLocation={!!location}
          showsMyLocationButton={false}
          customMapStyle={DARK_MAP_STYLE}
        >
          {businesses.map((biz) => (
            <Marker
              key={biz.id}
              coordinate={{ latitude: biz.lat, longitude: biz.lng }}
              onPress={() => setSelected(biz)}
            >
              <View style={[styles.pin, selected?.id === biz.id && styles.pinSelected]}>
                <Text style={styles.pinText}>$</Text>
              </View>
              <Callout tooltip onPress={() => navigation.navigate('BusinessProfile', { businessId: biz.id })}>
                <View style={styles.callout}>
                  <Text style={styles.calloutName}>{biz.business_name}</Text>
                  <Text style={styles.calloutMeta}>★ {biz.avg_rating?.toFixed(1) || '—'} · {biz.category}</Text>
                  <Text style={styles.calloutLink}>View profile →</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      )}

      {businesses.length === 0 && !loading && (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyText}>No businesses found nearby</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 12,
    backgroundColor: '#07080a', zIndex: 10,
  },
  backBtn: {},
  backText: { fontSize: 14, color: '#FF8C42', fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  map: { flex: 1 },
  loaderOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pin: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FF5C00', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#ffffff',
    shadowColor: '#FF5C00', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4,
  },
  pinSelected: { width: 44, height: 44, borderRadius: 22 },
  pinText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  callout: {
    backgroundColor: '#0f1214', borderWidth: 1, borderColor: '#1e2226',
    borderRadius: 14, padding: 12, minWidth: 160, gap: 4,
  },
  calloutName: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  calloutMeta: { fontSize: 12, color: '#9ca3af' },
  calloutLink: { fontSize: 12, color: '#FF5C00', fontWeight: '600' },
  emptyOverlay: {
    position: 'absolute', bottom: 40, left: 22, right: 22,
    backgroundColor: '#0f1214', borderRadius: 14, padding: 16, alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: '#9ca3af' },
});

// Minimal dark map style for react-native-maps
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0f1214' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#07080a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1d1f' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111315' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0f14' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
