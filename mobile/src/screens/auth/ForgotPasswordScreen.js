import {
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
  View, Pressable, StyleSheet,
} from 'react-native';
import { useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import TextField from '../../components/TextField';
import Button from '../../components/Button';
import HeaderGlow from '../../components/HeaderGlow';
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
          <HeaderGlow width={480} height={280} offsetTop={-40} align="right" opacity={0.28} />

          {sent ? (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.successCard}>
              <View style={styles.successIconWrap}>
                <Feather name="check" size={28} color={colors.success} strokeWidth={1.8} />
              </View>
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
              <View style={styles.footerRow}>
                <Feather name="arrow-left" size={14} color={colors.accentText} strokeWidth={1.8} />
                <Text style={styles.footerText}>Back to login</Text>
              </View>
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

  hero: { alignItems: 'center', marginBottom: spacing['2xl'] },
  brandMark: {
    fontSize: 48,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.accentText,
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
  successIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(46,189,133,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(46,189,133,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
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
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.accentText,
  },
});
