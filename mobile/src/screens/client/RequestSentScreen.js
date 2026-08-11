// RequestSentScreen — the reassurance screen after a client sends a direct
// booking request to one business (Path B in PAYMENTS.md).
//
// Spec: design/handoff-jet-pulse/PROOF-REQUEST-WEB-AUTOBID.md §2, frame 6a
// "Request sent confirmation" in SwingBy All Screens.dc.html.
//
// Replaces the walkthrough dead-end (B9 / D9): the targeted flow used to land
// on QuoteComparison, which renders "0 businesses quoted" one second after the
// request was sent — technically true, emotionally a failure screen, and with
// a back button that returns to the form you just submitted.
//
// This screen CLEARS THE STACK. It is reached with navigation.reset(), so the
// hardware back button leaves the flow instead of re-entering the wizard.
//
// A send icon, never a check: nothing is confirmed yet, only sent.
import React, { useCallback } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import Text from '../../components/Text';
import Button from '../../components/Button';
import HeaderGlow from '../../components/HeaderGlow';
import i18n from '../../i18n';
import { colors, radius, spacing } from '../../theme/tokens';

// "20 minutes" from a median-reply-time in minutes. Falls back to the vaguer
// copy the spec asks for when the business has no history to average.
function replyCopy(businessName, medianMinutes) {
  const name = businessName || '';
  const mins = Number(medianMinutes);
  if (!name) return i18n.t('requestSent.subFallbackGeneric');
  if (!Number.isFinite(mins) || mins <= 0) {
    return i18n.t('requestSent.subFallback', { business: name });
  }
  const time =
    mins < 60
      ? `${Math.round(mins)} minutes`
      : `${Math.round(mins / 60)} hour${Math.round(mins / 60) === 1 ? '' : 's'}`;
  return i18n.t('requestSent.subReply', { business: name, time });
}

function Step({ index, active, title, body }) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepCircle, active ? styles.stepCircleActive : styles.stepCircleIdle]}>
        <Text style={[styles.stepNumber, active ? styles.stepNumberActive : styles.stepNumberIdle]}>
          {index}
        </Text>
      </View>
      <View style={styles.stepText}>
        <Text style={[styles.stepTitle, !active && styles.stepTitleIdle]}>{title}</Text>
        <Text style={[styles.stepBody, !active && styles.stepBodyIdle]}>{body}</Text>
      </View>
    </View>
  );
}

export default function RequestSentScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const {
    businessName,
    businessId,
    medianReplyMinutes,
    postId,
    postTitle,
    category,
    address,
  } = route.params || {};

  // Belt and braces on top of the reset(): if this screen somehow ends up with
  // history behind it, back still must not reach the form.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        navigation.navigate('ClientTabs', { screen: 'Home' });
        return true;
      });
      return () => sub.remove();
    }, [navigation])
  );

  // F060: this used to branch on a hasThread flag built from threadId/
  // interestId route params, meant to open the chat thread directly once one
  // existed. Neither param was ever supplied by this screen's sole caller
  // (PostJobScreen's navigation.reset), and none could be: a message thread
  // hangs off an interest (backend/app/api/messages.py _get_interest_thread),
  // and create_service_post only ever creates the post row at send-time — no
  // interest exists yet to thread even if the ids were wired through. The
  // branch was permanently dead code implying a capability that doesn't
  // exist at this point in the flow. Always send the client to the request
  // they just made instead.
  function openConversation() {
    // Pass the business through: this is the TARGETED flow, so the quotes
    // screen must not tell the client that "nearby pros have been notified"
    // when exactly one company was asked directly.
    navigation.navigate('QuoteComparison', {
      postId,
      postTitle,
      targetBusinessName: businessName,
    });
  }

  function requestMorePros() {
    navigation.navigate('Search', {
      category: category || undefined,
      address: address || undefined,
      prefillFromPostId: postId || undefined,
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <HeaderGlow width={420} height={260} offsetTop={-30} align="center" opacity={0.25} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.sendCircle}>
            <Feather name="send" size={28} color={colors.accentText} strokeWidth={1.8} />
          </View>
          <Text style={styles.title}>{i18n.t('requestSent.title')}</Text>
          <Text style={styles.sub}>{replyCopy(businessName, medianReplyMinutes)}</Text>
        </View>

        <View style={styles.stepsCard}>
          <Step
            index="1"
            active
            title={i18n.t('requestSent.step1Title')}
            body={i18n.t('requestSent.step1Body')}
          />
          <Step
            index="2"
            title={i18n.t('requestSent.step2Title')}
            body={i18n.t('requestSent.step2Body')}
          />
          <Step
            index="3"
            title={i18n.t('requestSent.step3Title')}
            body={i18n.t('requestSent.step3Body')}
          />
        </View>

        {/* No-payment reassurance — the whole point of the screen. */}
        <View style={styles.reassure}>
          <Feather
            name="lock"
            size={14}
            color={colors.textSecondary}
            strokeWidth={1.8}
            style={styles.reassureIcon}
          />
          <Text style={styles.reassureText}>
            <Text style={styles.reassureLead}>{i18n.t('requestSent.noPaymentLead')}</Text>
            {' '}
            {i18n.t('requestSent.noPaymentBody')}
          </Text>
        </View>

        <View style={styles.ctas}>
          <Button
            label={i18n.t('requestSent.trackRequest')}
            onPress={openConversation}
            style={styles.primaryCta}
          />
          <Button
            variant="secondary"
            label={i18n.t('requestSent.morePros')}
            onPress={requestMorePros}
            style={styles.secondaryCta}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    paddingHorizontal: spacing.lg - 4,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },

  hero: { alignItems: 'center', gap: spacing.md },
  sendCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.9,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 290,
  },

  stepsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.base,
    gap: 14,
  },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: { backgroundColor: colors.accentMuted },
  stepCircleIdle: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepNumber: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 12, lineHeight: 16 },
  stepNumberActive: { color: colors.accentText },
  stepNumberIdle: { color: colors.textSecondary },
  stepText: { flex: 1, gap: 3 },
  stepTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  stepTitleIdle: { color: colors.textSecondary },
  stepBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  stepBodyIdle: { color: colors.textTertiary },

  reassure: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: spacing.base,
  },
  reassureIcon: { marginTop: 2 },
  reassureText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  reassureLead: { fontFamily: 'Inter_600SemiBold', color: colors.textPrimary },

  ctas: { gap: spacing.md },
  primaryCta: { minHeight: 52 },
  secondaryCta: { minHeight: 48 },
});
