import { SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, View, Pressable } from 'react-native';
import { useState } from 'react';
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
      // Surface error under password field; also clear email if credentials invalid
      setPasswordError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: spacing.lg,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo area */}
          <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
            <Text variant="display2" style={{ marginBottom: spacing.xs }} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
              SwingBy
            </Text>
            <Text variant="body" color="secondary">
              Welcome back
            </Text>
          </View>

          {/* Email field */}
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

          {/* Spacer */}
          <View style={{ height: spacing.base }} />

          {/* Password field */}
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

          {/* Forgot password link */}
          <Pressable
            onPress={() => {/* TODO: navigate to ForgotPassword */}}
            style={{ alignSelf: 'flex-end', marginTop: spacing.sm }}
            accessibilityRole="link"
            accessibilityLabel="Forgot password"
          >
            <Text variant="small" color="accent">
              Forgot password?
            </Text>
          </Pressable>

          {/* Spacer */}
          <View style={{ height: spacing.lg }} />

          {/* Primary CTA */}
          <Button
            variant="primary"
            label="Log In"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
          />

          {/* Spacer */}
          <View style={{ height: spacing.base }} />

          {/* Divider */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginVertical: spacing.sm,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text
              variant="small"
              color="secondary"
              style={{ marginHorizontal: spacing.md }}
            >
              or
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          {/* Social buttons */}
          <Button
            variant="secondary"
            label="Continue with Apple"
            disabled
            style={{ marginBottom: spacing.sm }}
          />
          <Button
            variant="secondary"
            label="Continue with Google"
            disabled
          />

          {/* Sign-up footer */}
          <Pressable
            onPress={() => navigation.navigate('Onboarding')}
            style={{ marginTop: spacing.xl, alignItems: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="Don't have an account? Sign up"
          >
            <Text variant="body" color="secondary">
              Don't have an account?{' '}
              <Text variant="body" color="accent">
                Sign up
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
