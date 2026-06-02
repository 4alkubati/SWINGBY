import React, { useState, useRef } from 'react';
import {
  SafeAreaView, KeyboardAvoidingView, ScrollView,
  Platform, Pressable, View,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring, Easing, FadeIn,
} from 'react-native-reanimated';

import { colors, spacing } from '../theme/tokens';
import Text from '../components/Text';
import TextField from '../components/TextField';
import Button from '../components/Button';
import Tabs from '../components/Tabs';
import Stack from '../components/Stack';
import { useAuth } from '../context/AuthContext';

// ─── Email validation ───────────────────────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ─── Animated block that slides + fades in once mounted ─────────────────────
function SlideIn({ children, delay = 0 }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);

  React.useEffect(() => {
    const d = delay;
    opacity.value = withTiming(1, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
    translateY.value = withSpring(0, { stiffness: 200, damping: 22, delay: d });
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

// ─── Step indicator dot ──────────────────────────────────────────────────────
function StepDots({ step }) {
  return (
    <View
      style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg }}
      accessibilityLabel={`Step ${step + 1} of 3`}
      accessibilityRole="progressbar"
      accessible={true}
    >
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          accessible={false}
          style={{
            width: i === step ? 20 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === step ? colors.accent : colors.border,
          }}
        />
      ))}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function SignupScreen({ navigation }) {
  const { signup } = useAuth();

  // ─── Step state (0 = email, 1 = password+name, 2 = role) ─────────────────
  const [step, setStep] = useState(0);

  // ─── Form fields ──────────────────────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roleIndex, setRoleIndex] = useState(0); // 0 = client, 1 = business_owner

  // ─── Error state (per-field + general) ────────────────────────────────────
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [firstNameError, setFirstNameError] = useState('');
  const [lastNameError, setLastNameError] = useState('');
  const [generalError, setGeneralError] = useState('');

  // ─── Loading ───────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef(null);

  // ─── Step 1: Validate email and advance ───────────────────────────────────
  function handleContinue() {
    setEmailError('');
    if (!email.trim()) {
      setEmailError('Email is required.');
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setStep(1);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }

  // ─── Step 2: Validate password+name and advance ────────────────────────────
  function handleContinueStep2() {
    let valid = true;
    setPasswordError('');
    setFirstNameError('');
    setLastNameError('');

    if (!password) {
      setPasswordError('Password is required.');
      valid = false;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      valid = false;
    }
    if (!firstName.trim()) {
      setFirstNameError('First name is required.');
      valid = false;
    }
    if (!lastName.trim()) {
      setLastNameError('Last name is required.');
      valid = false;
    }
    if (!valid) return;

    setStep(2);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }

  // ─── Final: submit signup ─────────────────────────────────────────────────
  async function handleSignup() {
    setGeneralError('');
    setLoading(true);
    try {
      const role = roleIndex === 0 ? 'client' : 'business_owner';
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        phone: null, // preserved from original; phone not collected in new flow
      };
      const result = await signup(payload);
      if (result?.requiresConfirmation) {
        navigation.navigate('Login');
      }
      // If requiresConfirmation is false, AuthContext already set user → app auto-navigates.
    } catch (err) {
      setGeneralError(err.message || 'Signup failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xl,
            paddingBottom: spacing['2xl'],
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <Stack spacing="xs" style={{ marginBottom: spacing.xl }}>
            <Text variant="display2" accessibilityRole="header" maxFontSizeMultiplier={1.4}>Create Account</Text>
            <Text variant="body" color="secondary">Join SwingBy today</Text>
          </Stack>

          {/* ── Step dots ──────────────────────────────────────────────────── */}
          <StepDots step={step} />

          <Stack spacing="base">
            {/* ── Step 1: Email + Continue ─────────────────────────────────── */}
            <Stack spacing="base">
              <TextField
                label="Email"
                value={email}
                onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(''); }}
                error={emailError}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={step === 0 ? handleContinue : undefined}
              />

              {step === 0 && (
                <Button
                  label="Continue"
                  onPress={handleContinue}
                />
              )}
            </Stack>

            {/* ── Step 2: Password + Name (animated slide in) ──────────────── */}
            {step >= 1 && (
              <SlideIn delay={0}>
                <Stack spacing="base">
                  <TextField
                    label="Password"
                    value={password}
                    onChangeText={(v) => { setPassword(v); if (passwordError) setPasswordError(''); }}
                    error={passwordError}
                    secureTextEntry
                    returnKeyType="next"
                  />
                  <TextField
                    label="First Name"
                    value={firstName}
                    onChangeText={(v) => { setFirstName(v); if (firstNameError) setFirstNameError(''); }}
                    error={firstNameError}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                  <TextField
                    label="Last Name"
                    value={lastName}
                    onChangeText={(v) => { setLastName(v); if (lastNameError) setLastNameError(''); }}
                    error={lastNameError}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={step === 1 ? handleContinueStep2 : undefined}
                  />

                  {step === 1 && (
                    <Button
                      label="Continue"
                      onPress={handleContinueStep2}
                    />
                  )}
                </Stack>
              </SlideIn>
            )}

            {/* ── Step 3: Role picker + Create Account (animated slide in) ─── */}
            {step >= 2 && (
              <SlideIn delay={60}>
                <Stack spacing="base">
                  <Text variant="small" color="secondary">I want to...</Text>
                  <Tabs
                    tabs={['Find Services', 'Offer Services']}
                    activeIndex={roleIndex}
                    onChange={setRoleIndex}
                  />

                  {generalError ? (
                    <Text variant="caption" color="danger">{generalError}</Text>
                  ) : null}

                  <Button
                    label="Create Account"
                    onPress={handleSignup}
                    loading={loading}
                  />
                </Stack>
              </SlideIn>
            )}
          </Stack>

          {/* ── Login link ────────────────────────────────────────────────── */}
          <Pressable
            onPress={() => navigation.navigate('Login')}
            style={{ marginTop: spacing.xl, alignItems: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="Already have an account? Log in"
          >
            <Text variant="small" color="secondary">
              Already have an account?{' '}
              <Text variant="small" style={{ color: colors.accent }}>
                Log in
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
