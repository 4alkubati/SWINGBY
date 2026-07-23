// T54 — HelpFAQScreen (accordion, reanimated, token-only)
import React, { useState } from 'react';
import { Pressable, ScrollView, Linking, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, radius, motion } from '../../theme/tokens';
import Text from '../../components/Text';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Surface from '../../components/Surface';

// ─── data ──────────────────────────────────────────────────────────────────
const FAQS = [
  {
    id: '1',
    question: 'How does SwingBy work?',
    answer:
      'SwingBy connects you with local service businesses in minutes. Post a job describing what you need — plumbing fix, house cleaning, lawn care, etc. — and set your preferred date. Nearby businesses will send you quotes. You review them side-by-side and accept the best one. Payment is handled securely through the app, and released to the business only after the job is completed.',
  },
  {
    id: '2',
    question: 'How do quotes get accepted?',
    answer:
      'After posting a job, you\'ll receive quotes from interested businesses in the Quotes tab. Each quote shows the business name, star rating, jobs completed, and their price. You can message a business directly from its quote to ask questions before you decide. Tap "Select" on the one you want. A booking is created instantly, both you and the business receive a confirmation, and the conversation carries over to the booking.',
  },
  {
    id: '3',
    question: 'When does payment happen?',
    answer:
      'When you accept a quote, your payment is placed in escrow — it\'s charged to your card but held securely. The business never receives the money until the job is completed and photo proof is submitted. Once you confirm the job is done (or after an automatic 24-hour window), the payment is released to the business. This protects both sides.',
  },
  {
    id: '4',
    question: 'What if a job goes wrong?',
    answer:
      'If there\'s an issue with a job, tap "Report a problem" on the booking screen. Our support team will review the case, including messages and photos submitted by both parties. Payment can be held in escrow during the investigation. We aim to resolve disputes within 48 hours. You can also reach us directly at 4alkubati@gmail.com.',
  },
  {
    id: '5',
    question: 'How do I become a business on SwingBy?',
    answer:
      'Sign up and select "I offer services" on the onboarding screen. You\'ll be asked for your business name, category, and service area. Once your profile is set up, you can start responding to job posts from clients in your area. For verified status (the green badge), submit your business license — our team reviews it manually within 1–2 business days.',
  },
  {
    id: '6',
    question: 'How do I delete my account?',
    answer:
      'Go to Settings → Delete my account. You\'ll be asked to confirm. Your account and all personal data will be permanently deleted within 30 days, except where retention is required by law. If you have an active booking, please complete or cancel it before deleting. Need help? Contact us at 4alkubati@gmail.com.',
  },
];

// ─── animated primitives ────────────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ─── AccordionItem ──────────────────────────────────────────────────────────
function AccordionItem({ item, isOpen, onToggle }) {
  // chevron rotation
  const rotation = useSharedValue(isOpen ? 90 : 0);

  // answer visibility: opacity + translateY
  const answerOpacity = useSharedValue(isOpen ? 1 : 0);
  const answerTranslateY = useSharedValue(isOpen ? 0 : -6);

  // card press scale
  const scale = useSharedValue(1);

  React.useEffect(() => {
    const timingConfig = {
      duration: isOpen ? motion.entryDuration : motion.exitDuration,
      easing: Easing.out(Easing.cubic),
    };

    rotation.value = withTiming(isOpen ? 90 : 0, timingConfig);
    answerOpacity.value = withTiming(isOpen ? 1 : 0, timingConfig);
    answerTranslateY.value = withTiming(isOpen ? 0 : -6, timingConfig);
  }, [isOpen]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const answerStyle = useAnimatedStyle(() => ({
    opacity: answerOpacity.value,
    transform: [{ translateY: answerTranslateY.value }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePressIn() {
    scale.value = withSpring(0.98, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
  }

  function handlePressOut() {
    scale.value = withSpring(1, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
  }

  return (
    <AnimatedPressable
      onPress={onToggle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={cardStyle}
    >
      <Surface
        elevation="subtle"
        padding={0}
        style={{ overflow: 'hidden', borderRadius: radius.card }}
      >
        {/* Question row */}
        <Inline
          spacing="md"
          align="center"
          justify="space-between"
          style={{
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.base,
            minHeight: 56,
          }}
        >
          <Text
            variant="bodyMedium"
            style={{ flex: 1, lineHeight: 22 }}
          >
            {item.question}
          </Text>

          <Animated.View style={chevronStyle}>
            <Feather name="chevron-right" size={16} color={colors.textSecondary} />
          </Animated.View>
        </Inline>

        {/* Answer — display toggled, animated in/out */}
        {isOpen && (
          <Animated.View style={answerStyle}>
            <Text
              variant="small"
              color="secondary"
              style={{
                paddingHorizontal: spacing.base,
                paddingBottom: spacing.base,
                lineHeight: 22,
              }}
            >
              {item.answer}
            </Text>
          </Animated.View>
        )}
      </Surface>
    </AnimatedPressable>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────
export default function HelpFAQScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [openId, setOpenId] = useState(null);

  function toggle(id) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top,
      }}
    >
      {/* ── Header ── */}
      <Inline
        justify="space-between"
        align="center"
        style={{
          paddingHorizontal: spacing.base,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>

        <Text variant="h2">Help & FAQ</Text>

        {/* spacer to keep title centered */}
        <View style={{ width: 40 }} />
      </Inline>

      {/* ── Content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          gap: spacing.base,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Stack spacing="xs" style={{ paddingHorizontal: spacing.xs }}>
          <Text variant="display3">Frequently asked questions</Text>
          <Text variant="body" color="secondary">
            {"Can't find what you need? "}
            <Text
              variant="body"
              onPress={() => Linking.openURL('mailto:4alkubati@gmail.com')}
              style={{ color: colors.accentText, fontWeight: '600' }}
            >
              Contact us
            </Text>
          </Text>
        </Stack>

        <Stack spacing="sm">
          {FAQS.map((faq) => (
            <AccordionItem
              key={faq.id}
              item={faq}
              isOpen={openId === faq.id}
              onToggle={() => toggle(faq.id)}
            />
          ))}
        </Stack>
      </ScrollView>
    </View>
  );
}
