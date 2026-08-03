// BetaInviteCardScreen — the first screen a recruited beta tester sees, opened
// from `swingby://invite?code=<CODE>` (or https://swingbyy.com/invite/<CODE>).
//
// Built from the 2026-06-17 design spec (deliverable 20260617-0001) for STRUCTURE,
// and from `design/DESIGN-SYSTEM.md` ("Jet × Pulse", installed 2026-07-24, binding)
// for STYLE. Where the two disagree the design system wins, because it is newer and
// binding. The spec's light-mode palette, amber pill badge and #F5F7FF surfaces all
// predate it and would have shipped a screen that looks like a different app.
//
// Deliberate deviations from the spec, each one paid for:
//   * "Invite expires in 7 days" — CUT. No invite expiry exists in the backend. A
//     countdown we do not enforce is the 50/50-payment-claim mistake again.
//   * "SwingBy Inc. © 2026" — CUT. There is no such company; the legal entity is
//     `4alkubati`. The line is now a plain brand copyright with no entity claim.
//   * "You're in! ✓" (U+2713) — replaced with a Feather icon. Zero emoji and
//     Feather-only are non-negotiables of the system.
//   * Pill badge -> `radius.chip`. Pills are reserved; the system says never-pills
//     for interactive chrome and nothing else on this screen is a pill.
//
// No backend call happens here, per the spec: the code is validated on the next
// screen. That is why this renders instantly and has no loading state — but it DOES
// have a no-code state, because a link can arrive without one.
import React, { useState, useCallback } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { show as showToast } from '../../services/toast';
import { buttonTap } from '../../services/haptics';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import Button from '../../components/Button';
import i18n from '../../i18n';
import HeaderGlow from '../../components/HeaderGlow';

// "swing-a7x3" / "SWINGA7X3" / "SWING-A7X3" all normalise to "SWING-A7X3".
// The spec requires uppercase and a hyphen after SWING; a link can carry any of
// these shapes, and showing a code that does not match what the sender sees is
// its own small trust failure.
export function normaliseCode(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const bare = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!bare) return null;
  return bare.startsWith('SWING') && bare.length > 5
    ? `SWING-${bare.slice(5)}`
    : bare;
}

export default function BetaInviteCardScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  const code = normaliseCode(route.params?.code);

  const onCopy = useCallback(async () => {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
      buttonTap();
      setCopied(true);
      showToast({ type: 'success', text1: i18n.t('invite.copied') });
      // Revert the affordance so a second copy is obviously possible. Without
      // this the button reads "done" forever and looks broken on return.
      setTimeout(() => setCopied(false), 2400);
    } catch {
      showToast({ type: 'error', text1: i18n.t('invite.copyFailed') });
    }
  }, [code]);

  const goSignup = useCallback(() => {
    buttonTap();
    // The code rides along so signup can attribute the referral. Signup treats it
    // as optional, so a missing code never blocks anyone from creating an account.
    navigation.navigate('Signup', code ? { inviteCode: code } : undefined);
  }, [navigation, code]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      {/* B1/B3/B4 — hero. No photo: there is no vetted hero asset in the repo, and
          a missing <Image> source renders as a grey box on the very first screen a
          stranger sees. */}
      <View
        style={{
          paddingTop: insets.top + spacing.lg,
          paddingHorizontal: spacing.base,
          paddingBottom: spacing.xl,
          overflow: 'hidden',
        }}
      >
        {/* The sanctioned glow for this surface. tokens.js reserves the earnings
            gradient for the dashboard hero — "nothing else may use these" — and
            HeaderGlow is what every other auth/onboarding screen uses. */}
        <HeaderGlow />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.accentTint,
              borderColor: colors.borderAccent,
              borderWidth: 1,
              borderRadius: radius.chip,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.md,
            }}
          >
            <Text variant="label" style={{ color: colors.accentSoft, letterSpacing: 0.8 }}>
              {i18n.t('invite.badge')}
            </Text>
          </View>
        </View>

        <Text
          variant="display2"
          numberOfLines={2}
          style={{ marginTop: spacing.xl, color: colors.textPrimary }}
        >
          {i18n.t('invite.hero')}
        </Text>
      </View>

      <View style={{ paddingHorizontal: spacing.base }}>
        {/* B5 — inviter row. Static: this build has no per-inviter data, so naming
            a specific person would be inventing one. */}
        <View
          style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg }}
          accessible
          accessibilityLabel={`${i18n.t('invite.inviter')} ${i18n.t('invite.inviterRole')}`}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.avatar,
              backgroundColor: colors.accentMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="users" size={20} color={colors.accentSoft} />
          </View>
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Text variant="bodyMedium">{i18n.t('invite.inviter')}</Text>
            <Text variant="caption" color="secondary">
              {i18n.t('invite.inviterRole')}
            </Text>
          </View>
        </View>

        {/* B6/B7 */}
        <Text variant="h1" style={{ marginTop: spacing.lg }}>
          {i18n.t('invite.subhead')}
        </Text>
        <Text variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
          {i18n.t('invite.body1')}
        </Text>
        <Text variant="body" color="secondary" style={{ marginTop: spacing.base }}>
          {i18n.t('invite.body2')}
        </Text>

        {/* B8 — invite code, or an honest explanation of its absence. */}
        {code ? (
          <View
            style={{
              marginTop: spacing.lg,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.card,
              padding: spacing.base,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text variant="caption" color="tertiary">
                {i18n.t('invite.codeLabel')}
              </Text>
              <Text
                variant="h1"
                selectable
                style={{ marginTop: spacing.xs, letterSpacing: 1.2 }}
              >
                {code}
              </Text>
            </View>
            <Pressable
              onPress={onCopy}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('invite.copy')}
              // 44pt minimum touch target — the icon alone is 20pt.
              hitSlop={12}
              style={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.button,
                backgroundColor: colors.surfaceAlt,
              }}
            >
              <Feather
                name={copied ? 'check' : 'copy'}
                size={18}
                color={copied ? colors.success : colors.textSecondary}
              />
            </Pressable>
          </View>
        ) : (
          <View
            style={{
              marginTop: spacing.lg,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.card,
              padding: spacing.base,
            }}
          >
            <Text variant="bodyMedium">{i18n.t('invite.noCodeTitle')}</Text>
            <Text variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
              {i18n.t('invite.noCodeBody')}
            </Text>
          </View>
        )}

        {/* B9 — the one purple CTA on this screen, per the design system. */}
        <Button
          label={code ? i18n.t('invite.cta') : i18n.t('invite.continueAnyway')}
          onPress={goSignup}
          style={{ marginTop: spacing.lg }}
        />

        {/* B10 */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: spacing.base,
          }}
        >
          <Text variant="small" color="secondary">
            {i18n.t('invite.haveAccount')}
          </Text>
          <Pressable
            onPress={() => {
              buttonTap();
              navigation.navigate('Login');
            }}
            accessibilityRole="link"
            hitSlop={12}
            style={{ marginLeft: spacing.sm }}
          >
            <Text variant="smallMedium" style={{ color: colors.accentText }}>
              {i18n.t('invite.signIn')}
            </Text>
          </Pressable>
        </View>

        {/* B11 */}
        <Text
          variant="caption"
          color="tertiary"
          style={{ marginTop: spacing.lg, textAlign: 'center' }}
        >
          {i18n.t('invite.finePrint')}
        </Text>
        <Text
          variant="caption"
          color="tertiary"
          style={{ marginTop: spacing.xs, textAlign: 'center' }}
        >
          {i18n.t('invite.copyright')}
        </Text>
      </View>
    </ScrollView>
  );
}
