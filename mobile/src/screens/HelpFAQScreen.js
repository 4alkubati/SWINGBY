// T66 — HelpFAQScreen (accordion)
import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

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
      'After posting a job, you\'ll receive quotes from interested businesses in the Quotes tab. Each quote shows the business name, star rating, jobs completed, and their price. Tap "Select" on the one you want. A booking is created instantly, and both you and the business receive a confirmation. Chat opens only after a booking is confirmed.',
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

function AccordionItem({ item, isOpen, onToggle }) {
  const animHeight = useRef(new Animated.Value(0)).current;
  const animOpacity = useRef(new Animated.Value(0)).current;
  const animRotate = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(animHeight, {
        toValue: isOpen ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(animOpacity, {
        toValue: isOpen ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(animRotate, {
        toValue: isOpen ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen]);

  const maxHeight = animHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 400],
  });

  const rotate = animRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <View style={styles.accordionCard}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={onToggle}
        activeOpacity={0.75}
      >
        <Text style={styles.accordionQuestion}>{item.question}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Feather name="chevron-right" size={16} color="#6b7280" />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={[styles.accordionBody, { maxHeight }]}>
        <Animated.Text style={[styles.accordionAnswer, { opacity: animOpacity }]}>
          {item.answer}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

export default function HelpFAQScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [openId, setOpenId] = useState(null);

  function toggle(id) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color="#f0ede8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & FAQ</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Frequently asked questions</Text>
        <Text style={styles.pageSub}>
          Can't find what you need?{' '}
          <Text
            style={styles.contactLink}
            onPress={() => {
              import('react-native').then(({ Linking }) =>
                Linking.openURL('mailto:4alkubati@gmail.com')
              );
            }}
          >
            Contact us
          </Text>
        </Text>

        <View style={styles.list}>
          {FAQS.map((faq) => (
            <AccordionItem
              key={faq.id}
              item={faq}
              isOpen={openId === faq.id}
              onToggle={() => toggle(faq.id)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1d1f',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 16,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
    paddingHorizontal: 6,
  },
  pageSub: {
    fontSize: 14,
    color: '#6b7280',
    paddingHorizontal: 6,
    marginTop: -8,
  },
  contactLink: {
    color: '#FF8C42',
    fontWeight: '600',
  },
  list: {
    gap: 8,
  },
  accordionCard: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 16,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 56,
    gap: 12,
  },
  accordionQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#f0ede8',
    lineHeight: 22,
  },
  accordionBody: {
    overflow: 'hidden',
  },
  accordionAnswer: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
