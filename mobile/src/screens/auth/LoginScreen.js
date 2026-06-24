import {
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, View, Pressable,
  StyleSheet,
} from 'react-native';
import { useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../theme/tokens';
import Text from '../components/Text';
import TextField from '../components/TextField';
import Button from '../components/Button';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true);
    setEmailError('');
    setPasswordError('');
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      const message = err.message || 'Login failed. Check your credentials.';
      setPasswordError(message);
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

          {/* Hero */}
          <Animated.View entering={FadeInDown.duration(400).delay(80)} style={styles.hero}>
            <Text
              style={styles.brandMark}
              accessibilityRole="header"
              maxFontSizeMultiplier={1.4}
            >
              S
            </Text>
            <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
              Welcome back
            </Text>
            <Text style={styles.subtitle}>
              Log in to your SwingBy account
            </Text>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.form}>
            <TextField
              label="Email"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (emailError) setEmailError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={emailError}
            />

            <View style={{ height: spacing.base }} />

            <TextField
              label="Password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (passwordError) setPasswordError('');
              }}
              secureTextEntry
              error={passwordError}
            />

            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotLink}
              accessibilityRole="link"
              accessibilityLabel="Forgot password"
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          </Animated.View>

          {/* Actions */}
          <Animated.View entering={FadeInDown.duration(400).delay(320)}>
            <Button
              variant="primary"
              label="Log in"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable style={styles.ghostBtn} disabled>
              <Text style={styles.ghostBtnText}>Continue with Apple</Text>
            </Pressable>

            <View style={{ height: spacing.sm }} />

            <Pressable style={styles.ghostBtn} disabled>
              <Text style={styles.ghostBtnText}>Continue with Google</Text>
            </Pressable>
          </Animated.View>

          {/* Footer */}
          <Animated.View entering={FadeInDown.duration(400).delay(440)}>
            <Pressable
              onPress={() => navigation.navigate('Signup')}
              style={styles.footer}
              accessibilityRole="button"
              accessibilityLabel="Sign up"
            >
              <Text style={styles.footerText}>
                Don't have an account?{' '}
                <Text style={styles.footerLink}>Sign up</Text>
              </Text>
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
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },

  form: { marginBottom: spacing.lg },
  forgotLink: { alignSelf: 'flex-end', marginTop: spacing.sm },
  forgotText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.accentText,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.base,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginHorizontal: spacing.md,
  },

  ghostBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
    opacity: 0.5,
  },
  ghostBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
  },

  footer: { marginTop: spacing.xl, alignItems: 'center' },
  footerText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  footerLink: {
    color: colors.accentText,
    fontFamily: 'Inter_600SemiBold',
  },
});
