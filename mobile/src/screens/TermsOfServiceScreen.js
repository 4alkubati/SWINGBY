// T65 — TermsOfServiceScreen
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

const LAST_UPDATED = 'May 2025';

const SECTIONS = [
  {
    title: '1. Use of the Platform',
    body: `By creating an account on SwingBy, you agree to use the platform only for lawful purposes. You must be at least 18 years old to create an account.\n\n` +
      `Clients ("users") may post service requests and accept quotes from service providers. Service providers ("businesses") may submit quotes and complete booked jobs through the platform.\n\n` +
      `You agree not to: misrepresent your identity or credentials, post fraudulent job listings or quotes, attempt to circumvent the platform's payment system, or engage in harassment or abusive behaviour toward other users.\n\n` +
      `SwingBy reserves the right to suspend or terminate accounts that violate these terms.`,
  },
  {
    title: '2. Payments, Escrow & Refunds',
    body: `All payments on SwingBy are processed through our payment partner. When a client accepts a quote, payment is held in escrow until the job is marked complete by the service provider and photo proof is submitted.\n\n` +
      `Payment is automatically released to the service provider upon job completion. In cases of dispute, SwingBy may hold payment pending investigation.\n\n` +
      `Refunds: if a job is cancelled before it begins, a full refund will be issued. If a dispute arises after work has started, SwingBy will review submitted evidence (photos, messages) and make a final determination.\n\n` +
      `SwingBy charges a platform fee on each completed transaction. This fee is disclosed at the time of booking.`,
  },
  {
    title: '3. Disclaimers & Limitation of Liability',
    body: `SwingBy is a marketplace that connects clients with independent service providers. We do not employ service providers, and we are not responsible for the quality, safety, legality, or completion of services performed.\n\n` +
      `We verify business licenses where indicated by a "Verified" badge, but verification does not constitute an endorsement or guarantee of service quality.\n\n` +
      `To the maximum extent permitted by law, SwingBy's liability for any claim arising from your use of the platform is limited to the amount you paid for the relevant transaction.\n\n` +
      `These terms are governed by the laws of Alberta, Canada. For questions, contact legal@swingbyy.com`,
  },
];

export default function TermsOfServiceScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

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
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.docTitle}>Terms of Service</Text>
        <Text style={styles.docMeta}>Last updated: {LAST_UPDATED}</Text>
        <Text style={styles.docIntro}>
          Please read these Terms of Service carefully before using SwingBy. By accessing or using our platform, you agree to be bound by these terms.
        </Text>

        {SECTIONS.map((section, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.contactCard}>
          <Feather name="file-text" size={16} color="#FF8C42" style={{ marginBottom: 6 }} />
          <Text style={styles.contactTitle}>Legal questions?</Text>
          <Text style={styles.contactBody}>
            Email{' '}
            <Text style={styles.contactLink}>legal@swingbyy.com</Text>
            {' '}or{' '}
            <Text style={styles.contactLink}>4alkubati@gmail.com</Text>
          </Text>
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
    paddingHorizontal: 22,
    paddingTop: 24,
    gap: 20,
  },
  docTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.75,
  },
  docMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: -12,
  },
  docIntro: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 22,
  },
  section: {
    gap: 10,
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 16,
    padding: 18,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  sectionBody: {
    fontSize: 14,
    color: '#f0ede8',
    lineHeight: 22,
  },
  contactCard: {
    backgroundColor: 'rgba(255,92,0,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.15)',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  contactBody: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  contactLink: {
    color: '#FF8C42',
    fontWeight: '600',
  },
});
