// CARD-24 — biometric unlock gate. Shown instead of AuthNavigator/BusinessNavigator/
// ClientNavigator when the app boots with a stored session AND the user has
// opted into biometric unlock AND the device has biometrics enrolled
// (AuthContext decides all of that — this screen just runs the prompt and
// reports success/fallback back to it).
//
// Hard rule: there is always a way out. "Use password instead" never gets
// hidden or disabled, no matter how the biometric attempt goes.
import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useAuth } from '../../context/AuthContext';
import { authenticateAsync } from '../../services/biometrics';
import i18n from '../../i18n';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import Button from '../../components/Button';
import Stack from '../../components/Stack';
import HeaderGlow from '../../components/HeaderGlow';

export default function BiometricLockScreen() {
  const { completeBiometricUnlock, skipBiometric } = useAuth();
  const [status, setStatus] = useState('prompting'); // 'prompting' | 'failed'
  const [busy, setBusy] = useState(false);

  const attempt = useCallback(async () => {
    setBusy(true);
    setStatus('prompting');
    const result = await authenticateAsync(i18n.t('biometricLock.promptMessage'));
    setBusy(false);
    if (result.success) {
      completeBiometricUnlock();
    } else {
      setStatus('failed');
    }
  }, [completeBiometricUnlock]);

  useEffect(() => {
    attempt();
    // Only auto-trigger once on mount — after that it's user-initiated via
    // "Try again" so we never spam the OS prompt in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <HeaderGlow width={480} height={280} offsetTop={-40} align="right" opacity={0.28} />
      <View style={styles.content}>
        <Stack spacing="lg" align="center">
          <View style={styles.iconWrap}>
            <Feather name="lock" size={32} color={colors.accentText} strokeWidth={1.8} />
          </View>
          <Stack spacing="xs" align="center">
            <Text variant="h1" style={{ textAlign: 'center' }} accessibilityRole="header">
              {i18n.t('biometricLock.title')}
            </Text>
            <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
              {i18n.t('biometricLock.subtitle')}
            </Text>
          </Stack>

          {status === 'failed' && (
            <Animated.View entering={FadeInDown.duration(250)}>
              <Text variant="small" color="danger" style={{ textAlign: 'center' }}>
                {i18n.t('biometricLock.failed')}
              </Text>
            </Animated.View>
          )}
        </Stack>

        <Stack spacing="sm" style={styles.actions}>
          <Button
            variant="primary"
            label={i18n.t('biometricLock.tryAgain')}
            onPress={attempt}
            loading={busy}
          />
          <Button
            variant="ghost"
            label={i18n.t('biometricLock.usePassword')}
            onPress={skipBiometric}
          />
        </Stack>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
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
  actions: {
    marginTop: spacing.xl * 1.5,
  },
});
