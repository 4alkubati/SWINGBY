import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function EmployeeProfileScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { employeeId, businessId } = route.params || {};
  const [employee, setEmployee] = useState(null);
  const [business, setBusiness] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const calls = [
        api.get('/employees/'),
        businessId ? api.get(`/reviews/business/${businessId}`) : Promise.resolve([]),
        businessId ? api.get(`/businesses/${businessId}`) : Promise.resolve(null),
      ];
      const [emps, revs, biz] = await Promise.all(calls);
      const emp = (emps || []).find((e) => e.id === employeeId);
      setEmployee(emp || null);
      setReviews(revs || []);
      setBusiness(biz || null);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [employeeId, businessId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#FF5C00" size="large" />
      </View>
    );
  }

  const fullName = employee?.user
    ? `${employee.user.first_name} ${employee.user.last_name}`
    : 'Team member';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FF5C00" />}
      >
        {/* Identity */}
        <View style={styles.identityCard}>
          <View style={styles.bigAvatar}>
            <Text style={styles.bigAvatarText}>{initials(fullName)}</Text>
          </View>
          <Text style={styles.name}>{fullName}</Text>
          {employee?.role_title && <Text style={styles.roleTitle}>{employee.role_title}</Text>}

          {businessId && business?.business_name && (
            <TouchableOpacity
              onPress={() => navigation.navigate('BusinessProfile', { businessId })}
              style={styles.companyRow}
            >
              <Text style={styles.companyText}>{business.business_name} →</Text>
            </TouchableOpacity>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>—</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>—</Text>
              <Text style={styles.statLabel}>Jobs</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{reviews.length}</Text>
              <Text style={styles.statLabel}>Reviews</Text>
            </View>
          </View>
        </View>

        {/* Reviews */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Reviews</Text>
        </View>

        {reviews.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No reviews yet</Text>
          </View>
        ) : (
          <View style={styles.reviewsList}>
            {reviews.map((rev) => (
              <View key={rev.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewerName}>{rev.reviewer?.first_name || 'Client'}</Text>
                  <Text style={styles.reviewStars}>{'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}</Text>
                </View>
                {rev.comment ? <Text style={styles.reviewComment}>{rev.comment}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },
  loader: { flex: 1, backgroundColor: '#07080a', alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8,
  },
  backBtn: { fontSize: 24, color: '#9ca3af', width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  content: { paddingBottom: 40, gap: 4 },
  identityCard: {
    backgroundColor: '#0f1214', borderWidth: 1, borderColor: '#1e2226',
    borderRadius: 20, padding: 20, marginHorizontal: 22, marginTop: 8,
    alignItems: 'center', gap: 8,
  },
  bigAvatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF5C00',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF5C00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  bigAvatarText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  name: { fontSize: 22, fontWeight: '700', color: '#ffffff', letterSpacing: -0.5 },
  roleTitle: { fontSize: 14, color: '#9ca3af' },
  companyRow: { paddingVertical: 4 },
  companyText: { fontSize: 13, color: '#FF8C42', fontWeight: '600' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  statBox: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  statLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  statDivider: { width: 1, height: 32, backgroundColor: '#1a1d1f' },
  sectionHeader: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1.2 },
  reviewsList: { paddingHorizontal: 22, gap: 10 },
  reviewCard: {
    backgroundColor: '#0d0f10', borderWidth: 1, borderColor: '#1a1d1f',
    borderRadius: 14, padding: 14, gap: 6,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  reviewerName: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  reviewStars: { fontSize: 12, color: '#FF5C00' },
  reviewComment: { fontSize: 13, color: '#9ca3af', lineHeight: 18 },
  emptyCard: {
    marginHorizontal: 22, backgroundColor: '#0d0f10', borderWidth: 1,
    borderColor: '#1a1d1f', borderRadius: 14, padding: 20, alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: '#6b7280' },
});
