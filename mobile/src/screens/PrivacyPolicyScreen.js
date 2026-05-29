// T64 — PrivacyPolicyScreen
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

const LAST_UPDATED = 'May 2025';

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: `When you use SwingBy, we collect information you provide directly to us, such as when you create an account, post a job, send a message, or contact support.\n\n` +
      `This includes: name, email address, phone number, location data (for matching you with nearby service providers), payment information (processed securely via our payment partner), and photos you upload as part of a job post or proof of work.\n\n` +
      `We also automatically collect certain usage data, including device identifiers, app interaction logs, and IP address.`,
  },
  {
    title: '2. How We Use Your Information',
    body: `We use the information we collect to:\n\n` +
      `• Operate and improve the SwingBy platform\n` +
      `• Match clients with service providers in their area\n` +
      `• Process payments and protect both parties through escrow\n` +
      `• Send you booking confirmations, status updates, and service notifications\n` +
      `• Respond to your questions and support requests\n` +
      `• Detect and prevent fraud or abuse\n\n` +
      `We do not sell your personal information to third parties. We may share limited data with service providers who help us operate the platform (e.g., payment processors, push notification services).`,
  },
  {
    title: '3. Your Rights & Data Retention',
    body: `You have the right to access, correct, or delete your personal data at any time. You can export your data directly from Settings → Export my data. To delete your account and all associated data, go to Settings → Delete my account.\n\n` +
      `We retain your data for as long as your account is active, or as required by applicable law. Upon account deletion, we purge personally identifiable information within 30 days, except where retention is legally required.\n\n` +
      `For privacy questions or requests, contact us at: privacy@swingbyy.com\n\n` +
      `This policy may be updated periodically. We will notify you of material changes through the app.`,
  },
];

export default function PrivacyPolicyScreen() {
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
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.docTitle}>Privacy Policy</Text>
        <Text style={styles.docMeta}>Last updated: {LAST_UPDATED}</Text>
        <Text style={styles.docIntro}>
          SwingBy ("we", "us", "our") is committed to protecting your privacy. This policy explains how we collect, use, and protect your personal information when you use our app.
        </Text>

        {SECTIONS.map((section, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.contactCard}>
          <Feather name="mail" size={16} color="#FF8C42" style={{ marginBottom: 6 }} />
          <Text style={styles.contactTitle}>Questions?</Text>
          <Text style={styles.contactBody}>
            Email us at{' '}
            <Text style={styles.contactLink}>privacy@swingbyy.com</Text>
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
