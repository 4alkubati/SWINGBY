// TermsConsent — the agreement the signup form never asked for.
//
// Nothing in SignupScreen mentioned the Terms or the Privacy Policy: no
// checkbox, no passive line, not even a link. That is a problem three times
// over — App Store review looks for it, PIPEDA/PIPA want consent to be a
// positive act, and we had no way to say a given account ever agreed.
//
// TWO SHAPES, deliberately different:
//
//   <TermsConsent>  a real checkbox that GATES account creation. Used on the
//                   signup screen, where the person is knowingly creating an
//                   account and the box is the record that they agreed.
//   <TermsNotice>   a passive line, no gate. Used on the login screen, where
//                   Apple/Google sign-in can still mint a brand-new account in
//                   one tap and a blocking checkbox would be hostile to the
//                   returning users that screen is actually for.
//
// THE LINKS HAVE TO GO SOMEWHERE. `TermsOfService` and `PrivacyPolicy` were
// registered in ClientNavigator and BusinessNavigator only — both LOGGED-IN
// stacks. Tapping either from the auth stack would have thrown. They are now
// registered in AuthNavigator too, and navigator-routes.test.js pins that,
// because a consent link that does nothing is worse than no link at all: it is
// exactly the failure an App Store reviewer taps first.

import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import Text from './Text';
import i18n from '../i18n';
import { colors, spacing, radius } from '../theme/tokens';

// Terms / Privacy as tappable text. Kept in one place so the checkbox and the
// passive notice can never drift apart or link to different screens.
function LegalLinks({ prefix }) {
  const navigation = useNavigation();

  return (
    <Text style={styles.legalText}>
      {prefix}{' '}
      <Text
        style={styles.legalLink}
        accessibilityRole="link"
        onPress={() => navigation.navigate('TermsOfService')}
      >
        {i18n.t('auth.agreeTerms')}
      </Text>
      {' '}{i18n.t('auth.agreeAnd')}{' '}
      <Text
        style={styles.legalLink}
        accessibilityRole="link"
        onPress={() => navigation.navigate('PrivacyPolicy')}
      >
        {i18n.t('auth.agreePrivacy')}
      </Text>
      .
    </Text>
  );
}

export default function TermsConsent({ checked, onChange, error }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {/* The box itself is the touch target for the toggle. The link text is
            NOT inside it — tapping "Privacy Policy" must open the policy, not
            silently tick the box. */}
        <Pressable
          onPress={() => onChange(!checked)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!checked }}
          accessibilityLabel={i18n.t('auth.agreePrefix')}
          testID="terms-consent-checkbox"
          style={[
            styles.box,
            checked && styles.boxChecked,
            !!error && !checked && styles.boxError,
          ]}
        >
          {checked ? (
            <Feather name="check" size={14} color={colors.bg} />
          ) : null}
        </Pressable>

        <View style={styles.labelWrap}>
          <LegalLinks prefix={i18n.t('auth.agreePrefix')} />
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function TermsNotice() {
  return (
    <View style={styles.noticeWrap}>
      <LegalLinks prefix={i18n.t('auth.agreeNotice')} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.base },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm ?? 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  boxError: { borderColor: colors.danger },
  labelWrap: { flex: 1 },
  legalText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 19,
  },
  legalLink: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.accentText,
    textDecorationLine: 'underline',
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.danger,
    marginTop: spacing.xs,
  },
  noticeWrap: { marginTop: spacing.base, paddingHorizontal: spacing.xs },
});
