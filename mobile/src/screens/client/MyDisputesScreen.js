// MyDisputesScreen — GAP-AUDIT-2026-07-18 #6.
// GET /disputes/mine existed with zero mobile callers — disputes were
// write-only (file via DisputeFlowScreen, no way to see status afterward).
// Read-only list: status chip, issue type, booking context, filed-by/against.
import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import i18n from '../../i18n';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import Text from '../../components/Text';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Surface from '../../components/Surface';
import { colors, spacing, radius } from '../../theme/tokens';

const ISSUE_LABELS = {
  no_show: 'No-show',
  poor_quality: 'Quality concerns',
  damage: 'Damage to property',
  overcharge: 'Overcharge',
  safety: 'Safety concern',
  other: 'Other',
};

function statusPillStyle(status) {
  switch ((status || '').toLowerCase()) {
    case 'resolved':
      return { bg: colors.success + '24', border: colors.success + '4D', text: colors.success, label: i18n.t('disputes.statusResolved') };
    case 'dismissed':
      return { bg: colors.surfaceAlt, border: colors.border, text: colors.textSecondary, label: i18n.t('disputes.statusDismissed') };
    case 'under_review':
      return { bg: colors.accent + '24', border: colors.borderAccent, text: colors.accentText, label: i18n.t('disputes.statusUnderReview') };
    default: // open
      return { bg: colors.danger + '24', border: colors.danger + '4D', text: colors.danger, label: i18n.t('disputes.statusOpen') };
  }
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function DisputeCard({ item, isMine, onPress }) {
  const pill = statusPillStyle(item.status);
  const booking = item.bookings || {};
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Surface elevation="subtle" rounded="card" padding="base" style={{ marginBottom: spacing.sm }}>
        <Stack spacing="xs">
          <Inline justify="space-between" align="center">
            <Text variant="smallMedium">
              {ISSUE_LABELS[item.issue_type] || item.issue_type}
            </Text>
            <View
              style={{
                borderRadius: radius.chip,
                borderWidth: 1,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                backgroundColor: pill.bg,
                borderColor: pill.border,
              }}
            >
              <Text variant="caption" style={{ color: pill.text, fontWeight: '700', letterSpacing: 0.5 }}>
                {pill.label}
              </Text>
            </View>
          </Inline>

          <Text variant="small" color="secondary" numberOfLines={2}>
            {item.description}
          </Text>

          <Inline spacing="sm" align="center" style={{ marginTop: spacing.xs }}>
            <Text variant="caption" color="secondary">
              {isMine ? i18n.t('disputes.filedByYou') : i18n.t('disputes.filedAgainstYou')}
            </Text>
            {!!booking.service_category && (
              <Text variant="caption" color="secondary">· {booking.service_category}</Text>
            )}
            {!!item.created_at && (
              <Text variant="caption" color="secondary">· {formatDate(item.created_at)}</Text>
            )}
          </Inline>

          {item.status === 'resolved' && !!item.resolution_notes && (
            <Text variant="caption" color="secondary" style={{ marginTop: spacing.xs, fontStyle: 'italic' }}>
              {item.resolution_notes}
            </Text>
          )}
        </Stack>
      </Surface>
    </Pressable>
  );
}

export default function MyDisputesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await api.get('/disputes/mine');
      setItems(data?.items || []);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const containerStyle = { flex: 1, backgroundColor: colors.bg, paddingTop: insets.top };

  const header = (
    <Inline
      justify="space-between"
      align="center"
      style={{
        paddingHorizontal: spacing.base,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={i18n.t('common.back')}
        style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
      >
        <Feather name="arrow-left" size={20} color={colors.textPrimary} />
      </Pressable>
      <Text variant="h2" style={{ flex: 1, textAlign: 'center' }}>
        {i18n.t('disputes.title')}
      </Text>
      <View style={{ width: 36 }} />
    </Inline>
  );

  if (status === 'loading') {
    return (
      <View style={containerStyle}>
        {header}
        <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.base }}>
          <SkeletonList count={4} />
        </View>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={containerStyle}>
        {header}
        <EmptyState
          icon="wifi-off"
          title={i18n.t('disputes.loadError')}
          action={{ label: i18n.t('common.retry'), onPress: load }}
        />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      {header}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
          paddingTop: spacing.base,
          paddingBottom: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <DisputeCard
            item={item}
            isMine={item.opened_by === user?.id}
            onPress={() => {
              const bookingId = item.booking_id || item.bookings?.id;
              if (bookingId) navigation.navigate('BookingDetails', { bookingId });
            }}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="shield"
            title={i18n.t('disputes.empty')}
            body={i18n.t('disputes.emptyBody')}
          />
        }
      />
    </View>
  );
}
