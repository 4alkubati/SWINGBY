// One report, one decision.
//
// The four outcomes are the ones content_reports.action_taken accepts, and they
// are deliberately different in weight:
//
//   Dismiss   reviewed, nothing wrong. A real outcome, not a non-action —
//             recording it is what stops the same report resurfacing.
//   Hide      stamps hidden_at, so the content stops rendering everywhere.
//             This is the capability that makes "we remove objectionable
//             content" true rather than aspirational (Guideline 1.2).
//   Warn      recorded, no automatic consequence. The honest label for
//             "noted, we'll watch this account".
//   Suspend   flips users.is_suspended, which visibility.hidden_user_ids
//             already reads — the account leaves discovery immediately.
//
// Resolving is a ONE-WAY door: the backend 409s a second attempt, because
// suspending twice or re-hiding something an admin has since restored are both
// wrong. So the destructive actions confirm first.
import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import Text from '../../components/Text';
import Surface from '../../components/Surface';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import Avatar from '../../components/Avatar';
import { show as showToast } from '../../services/toast';
import { resolveReport } from '../../services/moderation';
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
  scam_or_fraud: 'Scam or fraud',
  off_platform_solicitation: 'Off-platform solicitation',
  spam: 'Spam',
  other: 'Other',
};

function fullName(u) {
  return [u?.first_name, u?.last_name].filter(Boolean).join(' ') || 'Unknown';
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <Inline justify="space-between" align="flex-start" style={{ paddingVertical: 6 }}>
      <Text variant="caption" color="secondary">
        {label}
      </Text>
      <Text variant="small" style={{ flex: 1, textAlign: 'right' }} numberOfLines={3}>
        {value}
      </Text>
    </Inline>
  );
}

export default function ReportReviewScreen({ route, navigation }) {
  const report = route.params?.report || {};
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(null); // the action currently in flight

  // Only a report whose owner actually resolved can be acted on at the USER
  // level. `reported_user_id` is null when the target row had already vanished
  // (see moderation.resolve_target_owner) — the content can still be hidden,
  // but there is nobody to suspend, so the control is not offered.
  const canSuspend = Boolean(report.reported_user_id);

  async function apply(action) {
    if (busy) return;
    setBusy(action);
    try {
      await resolveReport(report.id, action, notes.trim() || null);
      showToast({ type: 'success', text1: i18n.t('moderation.resolved') });
      navigation.goBack();
    } catch (err) {
      // 409 means somebody already decided this one — reload rather than
      // pretend it failed.
      showToast({
        type: 'error',
        text1:
          err?.response?.status === 409
            ? i18n.t('moderation.resolved')
            : i18n.t('moderation.resolveFailed'),
      });
      if (err?.response?.status === 409) navigation.goBack();
    } finally {
      setBusy(null);
    }
  }

  function confirm(action, label) {
    Alert.alert(label, i18n.t('moderation.reviewTitle'), [
      { text: i18n.t('common.cancel'), style: 'cancel' },
      { text: label, style: 'destructive', onPress: () => apply(action) },
    ]);
  }

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
        <Text style={styles.title}>{i18n.t('moderation.reviewTitle')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Stack spacing="base">
          <Surface elevation="subtle" rounded="card" padding="base">
            <Inline spacing="md" align="center">
              <Avatar
                uri={report.reported?.avatar_url}
                name={fullName(report.reported)}
                size={40}
              />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{fullName(report.reported)}</Text>
                <Text variant="caption" color="secondary">
                  {i18n.t('moderation.queueReportCount', {
                    count: report.reported_user_report_count || 1,
                  })}
                </Text>
              </View>
            </Inline>
          </Surface>

          <Surface elevation="subtle" rounded="card" padding="base">
            <Row label="Reason" value={REASON_LABEL[report.reason] || report.reason} />
            <View style={styles.divider} />
            <Row
              label="Content"
              value={TARGET_LABEL[report.target_type] || report.target_type}
            />
            <View style={styles.divider} />
            <Row label="Reported by" value={fullName(report.reporter)} />
            {report.details ? (
              <>
                <View style={styles.divider} />
                <Row label="Details" value={report.details} />
              </>
            ) : null}
          </Surface>

          <TextField
            label={i18n.t('moderation.resolutionLabel')}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={1000}
          />

          <Stack spacing="sm">
            <Button
              variant="secondary"
              label={i18n.t('moderation.actionNone')}
              onPress={() => apply('none')}
              loading={busy === 'none'}
              disabled={!!busy}
            />
            <Button
              variant="secondary"
              label={i18n.t('moderation.actionWarn')}
              onPress={() => apply('user_warned')}
              loading={busy === 'user_warned'}
              disabled={!!busy || !canSuspend}
            />
            <Button
              label={i18n.t('moderation.actionHide')}
              onPress={() =>
                confirm('content_hidden', i18n.t('moderation.actionHide'))
              }
              loading={busy === 'content_hidden'}
              disabled={!!busy}
            />
            <Button
              variant="danger"
              label={i18n.t('moderation.actionSuspend')}
              onPress={() =>
                confirm('user_suspended', i18n.t('moderation.actionSuspend'))
              }
              loading={busy === 'user_suspended'}
              disabled={!!busy || !canSuspend}
            />
          </Stack>
        </Stack>
      </ScrollView>
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
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
});
