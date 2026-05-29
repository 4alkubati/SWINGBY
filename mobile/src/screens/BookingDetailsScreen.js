// T55 — BookingDetailsScreen
// Uber-style worker card + job details + action buttons.
// Route params: { bookingId }
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Share,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { api } from '../services/api';
import * as toast from '../services/toast';
import * as haptics from '../services/haptics';
import BookingStatusTimeline from '../components/BookingStatusTimeline';
import { RatingStarsDisplay } from '../components/RatingStars';
import { SkeletonBox } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

// ─── helpers ──────────────────────────────────────────────────────────────────
function toInitials(name) {
  return (name || '??').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-CA', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return iso; }
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function paymentPillStyle(status) {
  switch ((status || '').toLowerCase()) {
    case 'paid':    return { bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.3)', text: '#4ade80' };
    case 'pending': return { bg: 'rgba(255,92,0,0.10)',   border: 'rgba(255,92,0,0.25)',  text: '#FF8C42' };
    case 'failed':  return { bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.3)',  text: '#ef4444' };
    default:        return { bg: '#131618',               border: '#2a2e33',              text: '#9ca3af' };
  }
}

// ─── Skeleton layout ──────────────────────────────────────────────────────────
function BookingSkeleton() {
  return (
    <ScrollView contentContainerStyle={{ padding: 22, gap: 18 }} showsVerticalScrollIndicator={false}>
      <SkeletonBox width="100%" height={60} borderRadius={14} />
      <SkeletonBox width="100%" height={130} borderRadius={18} />
      <SkeletonBox width="100%" height={180} borderRadius={18} />
    </ScrollView>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function BookingDetailsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params ?? {};

  const [booking, setBooking] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error | deleted

  const fetchBooking = useCallback(async () => {
    if (!bookingId) { setStatus('deleted'); return; }
    setStatus('loading');
    try {
      const data = await api.get(`/bookings/${bookingId}`);
      setBooking(data);
      setStatus('ready');
    } catch (err) {
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        setStatus('deleted');
      } else {
        setStatus('error');
      }
    }
  }, [bookingId]);

  useEffect(() => { fetchBooking(); }, [fetchBooking]);

  const handleShare = async () => {
    const link = `swingby://booking/${bookingId}`;
    try {
      await Clipboard.setStringAsync(link);
      toast.show({ type: 'success', text1: 'Link copied', text2: link });
    } catch {
      toast.show({ type: 'error', text1: 'Could not copy link' });
    }
  };

  const openInMaps = (address) => {
    if (!address) return;
    const encoded = encodeURIComponent(address);
    const url = Platform.OS === 'ios'
      ? `maps://?q=${encoded}`
      : `geo:0,0?q=${encoded}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${encoded}`)
    );
  };

  const handleMessage = () => {
    navigation.navigate('MessageThread', { bookingId });
  };

  const handleCancel = () => {
    navigation.navigate('CancellationFlow', {
      bookingId,
      scheduledDate: booking?.scheduled_at,
    });
  };

  // ── header ──
  const headerRight = (
    <TouchableOpacity onPress={handleShare} style={styles.shareBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Feather name="share-2" size={18} color="#9ca3af" />
    </TouchableOpacity>
  );

  if (status === 'loading') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <View style={{ width: 36 }} />
        </View>
        <BookingSkeleton />
      </View>
    );
  }

  if (status === 'deleted') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, flex: 1 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <View style={{ width: 36 }} />
        </View>
        <EmptyState icon="trash-2" title="Booking no longer exists" body="This booking may have been cancelled or removed." />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, flex: 1 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <View style={{ width: 36 }} />
        </View>
        <EmptyState
          icon="wifi-off"
          title="Could not load booking"
          body="Check your connection and try again."
          action={{ label: 'Retry', onPress: fetchBooking }}
        />
      </View>
    );
  }

  const worker = booking?.worker ?? booking?.employee ?? {};
  const workerName = worker.name ?? worker.full_name ?? 'Worker';
  const workerRole = worker.role_title ?? 'Service Provider';
  const companyName = booking?.business_name ?? worker.company_name ?? '';
  const workerRating = parseFloat(worker.avg_rating ?? worker.rating ?? 0);
  const workerJobs = worker.job_count ?? worker.review_count ?? 0;

  const payPill = paymentPillStyle(booking?.payment_status);
  const canCancel = ['confirmed', 'on_the_way'].includes(booking?.status);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        {headerRight}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Status timeline */}
        <View style={styles.timelineCard}>
          <BookingStatusTimeline currentStatus={booking?.status ?? 'confirmed'} />
        </View>

        {/* Worker card (Uber-style) */}
        <View style={styles.workerCard}>
          <View style={styles.workerAvatarWrap}>
            <View style={styles.workerAvatar}>
              <Text style={styles.workerInitials}>{toInitials(workerName)}</Text>
            </View>
          </View>

          <View style={styles.workerInfo}>
            <Text style={styles.workerName}>{workerName}</Text>
            <Text style={styles.workerRole}>{workerRole}</Text>
            {!!companyName && (
              <TouchableOpacity
                onPress={() => navigation.navigate('BusinessProfile', { businessId: booking?.business_id })}
                activeOpacity={0.75}
              >
                <Text style={styles.workerCompany}>{companyName}</Text>
              </TouchableOpacity>
            )}
            <View style={styles.workerMeta}>
              <RatingStarsDisplay rating={workerRating} size={13} />
              <Text style={styles.workerJobs}>{workerJobs} jobs</Text>
            </View>
          </View>
        </View>

        {/* Job details card */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Job Details</Text>

          <View style={styles.detailRow}>
            <Feather name="briefcase" size={15} color="#FF5C00" />
            <Text style={styles.detailLabel}>Service</Text>
            <Text style={styles.detailValue}>{booking?.category ?? booking?.service_type ?? '—'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Feather name="calendar" size={15} color="#FF5C00" />
            <Text style={styles.detailLabel}>Scheduled</Text>
            <Text style={styles.detailValue}>
              {formatDate(booking?.scheduled_at)} {formatTime(booking?.scheduled_at)}
            </Text>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.detailRow}
            onPress={() => openInMaps(booking?.address)}
            activeOpacity={0.75}
          >
            <Feather name="map-pin" size={15} color="#FF5C00" />
            <Text style={styles.detailLabel}>Address</Text>
            <Text style={[styles.detailValue, styles.detailLink]} numberOfLines={2}>
              {booking?.address ?? '—'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Feather name="dollar-sign" size={15} color="#FF5C00" />
            <Text style={styles.detailLabel}>Price</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceText}>
                ${parseFloat(booking?.quoted_price ?? booking?.price ?? 0).toFixed(2)}
              </Text>
              <View style={[styles.payPill, { backgroundColor: payPill.bg, borderColor: payPill.border }]}>
                <Text style={[styles.payPillText, { color: payPill.text }]}>
                  {(booking?.payment_status ?? 'pending').toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Spacer for bottom buttons */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action buttons — bottom 1/3 thumb-reach zone */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.messageBtn}
          onPress={handleMessage}
          activeOpacity={0.85}
        >
          <Feather name="message-circle" size={18} color="#ffffff" />
          <Text style={styles.messageBtnText}>Message</Text>
        </TouchableOpacity>

        {canCancel && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            activeOpacity={0.75}
          >
            <Text style={styles.cancelBtnText}>Cancel booking</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1d1f',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3 },
  shareBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 12, paddingBottom: 16 },

  timelineCard: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },

  workerCard: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  workerAvatarWrap: {
    shadowColor: 'rgba(255,92,0,0.35)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 6,
  },
  workerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF5C00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerInitials: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  workerInfo: { flex: 1, gap: 3 },
  workerName: { fontSize: 17, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3 },
  workerRole: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },
  workerCompany: { fontSize: 13, color: '#FF8C42', fontWeight: '600', marginTop: 2 },
  workerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  workerJobs: { fontSize: 12, color: '#6b7280' },

  detailsCard: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 18,
    padding: 16,
    gap: 0,
  },
  detailsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  detailLabel: { fontSize: 13, color: '#9ca3af', fontWeight: '500', width: 72 },
  detailValue: { flex: 1, fontSize: 14, color: '#f0ede8', fontWeight: '500', textAlign: 'right' },
  detailLink: { color: '#FF8C42', textDecorationLine: 'underline' },
  divider: { height: 1, backgroundColor: '#1a1d1f' },

  priceRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  priceText: { fontSize: 20, fontWeight: '700', color: '#ffffff', letterSpacing: -0.5 },
  payPill: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  payPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#07080a',
    borderTopWidth: 1,
    borderTopColor: '#1a1d1f',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF5C00',
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: 'rgba(255,92,0,0.35)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 6,
    minHeight: 50,
  },
  messageBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
});
