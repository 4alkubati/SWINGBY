import {
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
  View, Pressable, StyleSheet,
} from 'react-native';
import { useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import TextField from '../../components/TextField';
import Button from '../../components/Button';
import { api } from '../../services/api';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: trimmed });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not send reset email. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Decorative glow */}
          <View style={styles.glowOrb} />

          {sent ? (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.successCard}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.title}>Check your inbox</Text>
              <Text style={styles.subtitle}>
                We've sent a password reset link to{'\n'}
                <Text style={styles.emailHighlight}>{email.trim()}</Text>
              </Text>
              <Text style={styles.hint}>
                Didn't receive it? Check your spam folder or{' '}
                <Text style={styles.retryLink} onPress={() => setSent(false)}>
                  try again
                </Text>
                .
              </Text>
            </Animated.View>
          ) : (
            <>
              <Animated.View entering={FadeInDown.duration(400).delay(80)} style={styles.hero}>
                <Text
                  style={styles.brandMark}
                  accessibilityRole="header"
                  maxFontSizeMultiplier={1.4}
                >
                  S
                </Text>
                <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
                  Forgot password?
                </Text>
                <Text style={styles.subtitle}>
                  Enter your email and we'll send a reset link.
                </Text>
              </Animated.View>

              <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.form}>
                <TextField
                  label="Email"
                  value={email}
                  onChangeText={(v) => { setEmail(v); if (error) setError(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  error={error}
                />
              </Animated.View>

              <Animated.View entering={FadeInDown.duration(400).delay(320)}>
                <Button
                  variant="primary"
                  label="Send reset link"
                  onPress={handleSubmit}
                  loading={loading}
                  disabled={loading}
                />
              </Animated.View>
            </>
          )}

          <Animated.View entering={FadeInDown.duration(400).delay(440)}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.footer}
              accessibilityRole="button"
              accessibilityLabel="Back to login"
            >
              <Text style={styles.footerText}>← Back to login</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },

  glowOrb: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.accentMuted,
    opacity: 0.35,
  },

  hero: { alignItems: 'center', marginBottom: spacing['2xl'] },
  brandMark: {
    fontSize: 48,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.accent,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.textPrimary,
    letterSpacing: -1,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  form: { marginBottom: spacing.lg },

  // Success card
  successCard: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  successIcon: {
    fontSize: 52,
    color: colors.success,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  emailHighlight: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  hint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  retryLink: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.accentText,
  },

  footer: { marginTop: spacing.xl, alignItems: 'center' },
  footerText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.accentText,
  },
});
