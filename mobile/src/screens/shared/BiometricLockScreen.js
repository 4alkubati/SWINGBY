// CARD-24 — biometric app-lock screen. Rendered directly from App.js (same
// pattern as AdminScreen — no navigator wraps it) when the user has opted
// into biometric unlock in Settings AND the device has it available.
//
// Fallback contract: a user who can't/won't authenticate biometrically is
// NEVER stuck here. "Sign in differently" always works — it signs them out
// back to the normal email/password Login screen.
import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { authenticateAsync } from '../../services/biometrics';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import Button from '../../components/Button';
import Stack from '../../components/Stack';
import i18n from '../../i18n';

export default function BiometricLockScreen({ onUnlocked, onUseDifferentAccount }) {
  const insets = useSafeAreaInsets();
  const [authenticating, setAuthenticating] = useState(false);
  const [declined, setDeclined] = useState(false);

  async function attempt() {
    setAuthenticating(true);
    setDeclined(false);
    const result = await authenticateAsync(i18n.t('biometric.prompt'));
    setAuthenticating(false);
    if (result.success) {
      onUnlocked();
    } else {
      setDeclined(true);
    }
  }

  // Auto-prompt on mount — "they log in using faceID" should not require an
  // extra tap to get the OS sheet up.
  useEffect(() => {
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Stack spacing="lg" align="center" style={styles.body}>
        <View style={styles.iconWrap}>
          <Feather name="lock" size={30} color={colors.accentText} strokeWidth={1.8} />
        </View>

        <Stack spacing="xs" align="center">
          <Text variant="display3" style={styles.center}>{i18n.t('biometric.lockedTitle')}</Text>
          <Text variant="body" color="secondary" style={styles.center}>
            {i18n.t('biometric.lockedBody')}
          </Text>
        </Stack>

        {authenticating ? (
          <ActivityIndicator color={colors.accent} size="large" style={{ marginTop: spacing.md }} />
        ) : (
          <Button
            variant="primary"
            label={i18n.t('biometric.unlockCta')}
            onPress={attempt}
            icon={<Feather name="unlock" size={16} color={colors.textPrimary} strokeWidth={2} />}
            style={{ minWidth: 220, marginTop: spacing.sm }}
          />
        )}

        {declined && !authenticating && (
          <Text variant="small" color="secondary" style={styles.center}>
            {i18n.t('biometric.declinedHint')}
          </Text>
        )}

        <Button
          variant="ghost"
          label={i18n.t('biometric.useDifferentAccount')}
          onPress={onUseDifferentAccount}
          style={{ marginTop: spacing.lg }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.avatar,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
});
