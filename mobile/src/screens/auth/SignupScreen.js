import React, { useState, useRef } from 'react';
import {
  SafeAreaView, KeyboardAvoidingView, ScrollView,
  Platform, Pressable, TouchableOpacity, View, StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring, FadeInDown,
} from 'react-native-reanimated';

import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius, motion } from '../../theme/tokens';
import Text from '../../components/Text';
import TextField from '../../components/TextField';
import Button from '../../components/Button';
import Tabs from '../../components/Tabs';
import HeaderGlow from '../../components/HeaderGlow';
import { useAuth } from '../../context/AuthContext';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function SlideIn({ children, delay = 0 }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);

  React.useEffect(() => {
    opacity.value = withTiming(1, { duration: 280 });
    translateY.value = withSpring(0, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
      ...(delay ? { delay } : {}),
    });
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

function StepDots({ step }) {
  return (
    <View
      style={styles.stepDots}
      accessibilityLabel={`Step ${step + 1} of 3`}
      accessibilityRole="progressbar"
      accessible
    >
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          accessible={false}
          style={[
            styles.dot,
            i === step ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

export default function SignupScreen({ navigation }) {
  const { signup } = useAuth();

  const [step, setStep] = useState(0);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roleIndex, setRoleIndex] = useState(0);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [firstNameError, setFirstNameError] = useState('');
  const [lastNameError, setLastNameError] = useState('');
  const [generalError, setGeneralError] = useState('');

  const [loading, setLoading] = useState(false);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [emailForConfirm, setEmailForConfirm] = useState('');
  const scrollRef = useRef(null);

  function handleContinue() {
    setEmailError('');
    if (!email.trim()) { setEmailError('Email is required.'); return; }
    if (!isValidEmail(email)) { setEmailError('Please enter a valid email address.'); return; }
    setStep(1);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }

  function handleContinueStep2() {
    let valid = true;
    setPasswordError('');
    setFirstNameError('');
    setLastNameError('');

    if (!password) { setPasswordError('Password is required.'); valid = false; }
    else if (password.length < 8) { setPasswordError('Password must be at least 8 characters.'); valid = false; }
    else if (!/[A-Z]/.test(password)) { setPasswordError('Add at least one uppercase letter.'); valid = false; }
    else if (!/[a-z]/.test(password)) { setPasswordError('Add at least one lowercase letter.'); valid = false; }
    else if (!/[0-9]/.test(password)) { setPasswordError('Add at least one number.'); valid = false; }
    if (!firstName.trim()) { setFirstNameError('First name is required.'); valid = false; }
    if (!lastName.trim()) { setLastNameError('Last name is required.'); valid = false; }
    if (!valid) return;

    setStep(2);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }

  async function handleSignup() {
    setGeneralError('');
    setLoading(true);
    try {
      const role = roleIndex === 0 ? 'client' : 'business_owner';
      const result = await signup({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        phone: null,
      });
      if (result?.requiresConfirmation) {
        setEmailForConfirm(email.trim().toLowerCase());
        setShowEmailConfirm(true);
      }
    } catch (err) {
      setGeneralError(err.message || 'Signup failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  if (showEmailConfirm) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.confirmWrap}>
          <HeaderGlow width={480} height={280} offsetTop={-40} align="center" opacity={0.24} />
          <Animated.View entering={FadeInDown.duration(400).delay(80)} style={styles.confirmInner}>
            <View style={styles.confirmIcon}>
              <Feather name="mail" size={28} color={colors.accentText} strokeWidth={1.8} />
            </View>
            <Text style={styles.confirmHeading}>Check your inbox</Text>
            <Text style={styles.confirmBody}>
              We sent a verification link to{' '}
              <Text style={styles.confirmEmail}>{emailForConfirm}</Text>.
              {'\n'}Tap it to activate your SwingBy account.
            </Text>
            <View style={styles.confirmActions}>
              <Button
                variant="primary"
                label="Back to login"
                onPress={() => navigation.navigate('Login')}
              />
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <HeaderGlow width={480} height={280} offsetTop={-40} align="left" opacity={0.28} />

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
              Create Account
            </Text>
            <Text style={styles.subtitle}>Join SwingBy today</Text>
          </Animated.View>

          {/* Step indicator */}
          <Animated.View entering={FadeInDown.duration(400).delay(160)}>
            <StepDots step={step} />
          </Animated.View>

          {/* Step 1: Email */}
          <Animated.View entering={FadeInDown.duration(400).delay(240)}>
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
              <View style={styles.stepAction}>
                <Button label="Continue" onPress={handleContinue} />
              </View>
            )}
          </Animated.View>

          {/* Step 2: Password + Name */}
          {step >= 1 && (
            <SlideIn>
              <View style={styles.stepGroup}>
                <TextField
                  label="Password"
                  value={password}
                  onChangeText={(v) => { setPassword(v); if (passwordError) setPasswordError(''); }}
                  error={passwordError}
                  secureTextEntry
                  returnKeyType="next"
                />
                <Text style={styles.passwordHint}>
                  At least 8 characters with an uppercase letter, a lowercase letter, and a number.
                </Text>
                <View style={{ height: spacing.base }} />
                <TextField
                  label="First Name"
                  value={firstName}
                  onChangeText={(v) => { setFirstName(v); if (firstNameError) setFirstNameError(''); }}
                  error={firstNameError}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                <View style={{ height: spacing.base }} />
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
                  <View style={styles.stepAction}>
                    <Button label="Continue" onPress={handleContinueStep2} />
                  </View>
                )}
              </View>
            </SlideIn>
          )}

          {/* Step 3: Role picker */}
          {step >= 2 && (
            <SlideIn delay={60}>
              <View style={styles.stepGroup}>
                <Text style={styles.roleLabel}>I want to...</Text>
                <Tabs
                  tabs={['Find Services', 'Offer Services']}
                  activeIndex={roleIndex}
                  onChange={setRoleIndex}
                />

                <Text style={styles.roleHint}>
                  {roleIndex === 0
                    ? 'Browse and book local service providers near you.'
                    : 'List your business and receive booking requests.'}
                </Text>

                {generalError ? (
                  <Text style={styles.errorText}>{generalError}</Text>
                ) : null}

                <Button
                  variant="primary"
                  label="Create Account"
                  onPress={handleSignup}
                  loading={loading}
                  disabled={loading}
                />
              </View>
            </SlideIn>
          )}

          {/* Footer */}
          <Animated.View entering={FadeInDown.duration(400).delay(360)}>
            <Pressable
              onPress={() => navigation.navigate('Login')}
              style={styles.footer}
              accessibilityRole="button"
              accessibilityLabel="Already have an account? Log in"
            >
              <Text style={styles.footerText}>
                Already have an account?{' '}
                <Text style={styles.footerLink}>Log in</Text>
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

  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 24, backgroundColor: colors.accent },
  dotInactive: { width: 6, backgroundColor: colors.border },

  stepAction: { marginTop: spacing.lg },
  stepGroup: { marginTop: spacing.lg },

  passwordHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  roleLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  roleHint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.danger,
    marginBottom: spacing.sm,
  },

  // Email confirmation view
  confirmWrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  confirmInner: {
    alignItems: 'center',
    gap: spacing.md,
    maxWidth: 320,
    width: '100%',
  },
  confirmIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmHeading: {
    fontSize: 26,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.textPrimary,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  confirmBody: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
  },
  confirmEmail: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  confirmActions: {
    marginTop: spacing.lg,
    width: '100%',
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
