import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View,
  Pressable, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import TextField from '../../components/TextField';
import Button from '../../components/Button';
import HeaderGlow from '../../components/HeaderGlow';
import { signInWithGoogle } from '../../services/socialAuth';
import { isAppleAuthAvailable, signInWithApple } from '../../services/appleAuth';
import { registerForPushAsync } from '../../services/notifications';

export default function LoginScreen({ navigation }) {
  // updateUser establishes the session in app state after a social sign-in:
  // updateUser(profile) with a null user resolves to the profile, which flips
  // RootNavigator into the logged-in stack — the same effect login() has,
  // without needing email/password. The access token is already live in the
  // axios client (set inside the social service), so /me and every subsequent
  // request are authenticated.
  const { login, updateUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Social sign-in state. `socialBusy` names which provider is mid-flight so
  // both buttons disable together and only the active one shows a spinner.
  const [socialBusy, setSocialBusy] = useState(null); // 'google' | 'apple' | null
  const [socialError, setSocialError] = useState('');
  const [appleReady, setAppleReady] = useState(false);

  // Apple button only appears on an iOS device that can actually do it. Off
  // iOS the stub module resolves isAppleAuthAvailable() to false, so this is a
  // no-op and the button never renders on Android.
  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await isAppleAuthAvailable();
      if (alive) setAppleReady(ok);
    })();
    return () => { alive = false; };
  }, []);

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

  async function handleSocial(provider) {
    if (socialBusy) return;
    setSocialBusy(provider);
    setSocialError('');
    try {
      const fn = provider === 'apple' ? signInWithApple : signInWithGoogle;
      // No role passed from Login: a genuinely new account defaults to
      // 'client'; the app can offer the "become a business" pick afterwards.
      const { profile } = await fn({});
      updateUser(profile);
      try { await registerForPushAsync(); } catch { /* non-fatal */ }
    } catch (err) {
      if (err?.code !== 'cancelled') {
        setSocialError(err?.message || 'Sign-in failed. Please try again.');
      }
    } finally {
      setSocialBusy(null);
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

            {socialError ? (
              <Text style={styles.socialError}>{socialError}</Text>
            ) : null}

            {/* Apple — iOS only. On Android appleReady is always false, so this
                branch never renders and no Apple code is reachable. */}
            {appleReady && (
              <>
                <Pressable
                  style={styles.socialBtn}
                  onPress={() => handleSocial('apple')}
                  disabled={!!socialBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Apple"
                >
                  {socialBusy === 'apple' ? (
                    <ActivityIndicator color={colors.textPrimary} />
                  ) : (
                    <Text style={styles.socialBtnText}>Continue with Apple</Text>
                  )}
                </Pressable>
                <View style={{ height: spacing.sm }} />
              </>
            )}

            <Pressable
              style={styles.socialBtn}
              onPress={() => handleSocial('google')}
              disabled={!!socialBusy}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
            >
              {socialBusy === 'google' ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <Text style={styles.socialBtnText}>Continue with Google</Text>
              )}
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

  socialBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    backgroundColor: colors.surface,
  },
  socialBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  socialError: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
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
