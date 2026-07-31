// Every content report waiting on a decision.
//
// App Store Guideline 1.2 does not merely ask for a report BUTTON — it asks the
// developer to "act on objectionable content reports within 24 hours". A report
// queue nobody can open is the same as no report mechanism at all, so this pair
// of screens (queue + review) is part of the requirement, not tooling around it.
//
// In-app rather than in web/admin/, for the same reason refund decisions moved:
// web/admin/ is not deployed. 1:1 with RefundQueueScreen so there is one shape
// for "admin triages a list".
//
// Repeat offenders sort first (the server does the ordering): one complaint is
// noise, five against the same account is a pattern, and the pattern is what an
// admin should see first.
import { useCallback, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import Text from '../../components/Text';
import Surface from '../../components/Surface';
import Inline from '../../components/Inline';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { listReportQueue } from '../../services/moderation';
import i18n from '../../i18n';
import { colors, spacing, radius } from '../../theme/tokens';

const TARGET_LABEL = {
  message: 'Message',
  review: 'Review',
  service_post: 'Job post',
  business: 'Business',
  user: 'Person',
  booking_photo: 'Photo',
  voice_note: 'Voice note',
};

const REASON_LABEL = {
  harassment: 'Harassment',
  hate_speech: 'Hate speech',
  sexual_content: 'Sexual content',
  violence: 'Violence',
  scam_or_fraud: 'Scam',
  off_platform_solicitation: 'Off-platform',
  spam: 'Spam',
  other: 'Other',
};

function fullName(u) {
  return [u?.first_name, u?.last_name].filter(Boolean).join(' ') || 'Unknown';
}

function shortDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function QueueRow({ item, onPress }) {
  const repeat = item.reported_user_report_count || 0;
  // Two or more reports against the same account is the threshold where the
  // count stops being trivia and starts being the reason to open this row.
  const isRepeat = repeat > 1;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Surface elevation="subtle" rounded="card" padding="base">
        <Inline spacing="md" align="flex-start">
          <Avatar
            uri={item.reported?.avatar_url}
            name={fullName(item.reported)}
            size={34}
          />
          <View style={{ flex: 1 }}>
            <Inline justify="space-between" align="flex-start">
              <Text variant="smallMedium" numberOfLines={1} style={{ flex: 1 }}>
                {REASON_LABEL[item.reason] || item.reason}
              </Text>
              {item.reported?.is_suspended ? (
                <Text style={styles.suspended}>Suspended</Text>
              ) : null}
            </Inline>
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {TARGET_LABEL[item.target_type] || item.target_type}
              {item.reported_user_id ? ` · ${fullName(item.reported)}` : ''}
              {item.created_at ? ` · ${shortDate(item.created_at)}` : ''}
            </Text>
            {isRepeat ? (
              <Inline spacing="sm" style={{ marginTop: 6 }}>
                <View style={[styles.chip, styles.chipAlert]}>
                  <Text variant="caption" style={{ color: colors.warning }}>
                    {i18n.t('moderation.queueReportCount', { count: repeat })}
                  </Text>
                </View>
              </Inline>
            ) : null}
            {item.details ? (
              <Text
                variant="caption"
                color="secondary"
                numberOfLines={2}
                style={{ marginTop: 6 }}
              >
                {item.details}
              </Text>
            ) : null}
          </View>
        </Inline>
      </Surface>
    </Pressable>
  );
}

export default function ReportQueueScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await listReportQueue());
    } catch (err) {
      setError(err?.message || 'Could not load the queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Re-pull on focus so a report just resolved is gone from the list — a stale
  // queue invites resolving the same report twice, which the backend 409s but
  // which still reads as a broken screen.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{i18n.t('moderation.queueTitle')}</Text>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <SkeletonList count={4} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.accent}
              colors={[colors.accent]}
              progressBackgroundColor={colors.surface}
            />
          }
          ListEmptyComponent={
            error ? (
              <EmptyState
                icon="alert-circle"
                title="Could not load the queue"
                body={error}
                action={{ label: i18n.t('common.retry'), onPress: load }}
              />
            ) : (
              <EmptyState
                icon="check-circle"
                title={i18n.t('moderation.queueEmptyTitle')}
                body={i18n.t('moderation.queueEmptyBody')}
              />
            )
          }
          renderItem={({ item }) => (
            <QueueRow
              item={item}
              onPress={() => navigation.navigate('ReportReview', { report: item })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  suspended: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: colors.danger,
    marginLeft: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.chip ?? 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  chipAlert: {
    borderColor: colors.warning,
    backgroundColor: colors.warningTint,
  },
});
