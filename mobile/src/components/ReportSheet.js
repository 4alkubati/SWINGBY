// ReportSheet — the Guideline 1.2(b) flag mechanism, as one reusable sheet.
//
// ONE sheet for every reportable surface. There are six of them (chat message,
// review, job post, business, person, photo) and a per-surface sheet would be
// six places for the reason list to drift out of step with
// content_reports.reason. The caller supplies only what is being reported.
//
// Shape follows the mock's sheet idiom: reason chips, an optional free-text
// box, one primary CTA. Nothing here is destructive to the reporter, so the CTA
// is `primary`, not `danger` — the red button belongs on Block, which does
// change what the user can see.
//
// The success state stays inside the sheet rather than firing a toast and
// closing. A report is a moment where the user needs to be told plainly that
// something happened; a toast that slides away in four seconds is not that.

import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';

import BottomSheet from './BottomSheet';
import Button from './Button';
import Chip from './Chip';
import Text from './Text';
import TextField from './TextField';
import { colors, spacing, radius } from '../theme/tokens';
import i18n from '../i18n';
import { reportContent, REPORT_REASONS } from '../services/moderation';

export default function ReportSheet({ visible, onClose, targetType, targetId, onReported }) {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // 'sent' | 'already' | 'failed'

  // Every open starts clean. Without this, reopening the sheet on a DIFFERENT
  // message would show the previous target's reason still selected — and the
  // user would file a report they did not mean to.
  React.useEffect(() => {
    if (visible) {
      setReason(null);
      setDetails('');
      setSubmitting(false);
      setResult(null);
    }
  }, [visible]);

  async function submit() {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      const res = await reportContent({
        targetType,
        targetId,
        reason,
        details: details.trim() || null,
      });
      if (res.alreadyReported) {
        setResult('already');
      } else {
        setResult('sent');
        onReported?.(res.report);
      }
    } catch {
      setResult('failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (result === 'sent' || result === 'already') {
    const sent = result === 'sent';
    return (
      <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.4]}>
        <View style={{ alignItems: 'center', paddingTop: spacing.lg, gap: spacing.md }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.pill,
              backgroundColor: colors.successTint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="check" size={28} color={colors.success} />
          </View>
          <Text variant="h1" style={{ textAlign: 'center' }}>
            {sent ? i18n.t('moderation.reportSent') : i18n.t('moderation.alreadyReported')}
          </Text>
          <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
            {sent
              ? i18n.t('moderation.reportSentBody')
              : i18n.t('moderation.alreadyReportedBody')}
          </Text>
          <Button
            variant="secondary"
            label={i18n.t('common.done')}
            onPress={onClose}
            style={{ alignSelf: 'stretch', marginTop: spacing.sm }}
          />
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.7, 0.9]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      >
        <Text variant="h1">{i18n.t('moderation.reportTitle')}</Text>
        <Text variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
          {i18n.t('moderation.reportSubtitle')}
        </Text>

        <Text variant="label" color="secondary" style={{ marginTop: spacing.lg }}>
          {i18n.t('moderation.reasonLabel')}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
            marginTop: spacing.sm,
          }}
        >
          {REPORT_REASONS.map((r) => (
            <Chip
              key={r.key}
              label={i18n.t(r.labelKey)}
              selected={reason === r.key}
              onPress={() => setReason(r.key)}
            />
          ))}
        </View>

        <TextField
          label={i18n.t('moderation.detailsLabel')}
          value={details}
          onChangeText={setDetails}
          placeholder={i18n.t('moderation.detailsPlaceholder')}
          multiline
          maxLength={2000}
          style={{ marginTop: spacing.lg }}
        />

        {result === 'failed' ? (
          <Text variant="small" style={{ color: colors.danger, marginTop: spacing.sm }}>
            {i18n.t('moderation.reportFailed')}
          </Text>
        ) : null}

        <Button
          label={submitting ? i18n.t('moderation.submitting') : i18n.t('moderation.submitReport')}
          onPress={submit}
          loading={submitting}
          // A report with no reason is not a report — the backend 400s on a
          // missing one, so the button says so before the round trip.
          disabled={!reason || submitting}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </BottomSheet>
  );
}
