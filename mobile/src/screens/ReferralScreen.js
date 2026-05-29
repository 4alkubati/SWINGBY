// T67 — ReferralScreen
import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';
import { show as showToast } from '../services/toast';

export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();

  const referralCode = (user?.id ?? 'SWINGBY1').slice(0, 8).toUpperCase();

  async function handleCopy() {
    try {
      await Clipboard.setStringAsync(referralCode);
      showToast({ type: 'success', text1: 'Copied' });
    } catch {
      showToast({ type: 'error', text1: 'Could not copy code' });
    }
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `Join me on SwingBy! Code: ${referralCode} — https://swingbyy.com`,
        title: 'SwingBy Referral',
      });
    } catch { /* user cancelled */ }
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
        <Text style={styles.headerTitle}>Referrals</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Glow orb */}
        <View style={styles.glowOrb} />

        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={styles.giftIconWrap}>
            <Text style={styles.giftIcon}>🎁</Text>
          </View>
          <Text style={styles.heroTitle}>Share SwingBy, get $10 credit</Text>
          <Text style={styles.heroBody}>
            When your friend completes their first booking, you both get $10 off your next job.
          </Text>
        </View>

        {/* Referral code card — FOCAL POINT */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
          <TouchableOpacity
            style={styles.codeTouchable}
            onPress={handleCopy}
            activeOpacity={0.8}
          >
            <Text style={styles.codeText}>{referralCode}</Text>
            <View style={styles.copyBadge}>
              <Feather name="copy" size={14} color="#FF8C42" />
              <Text style={styles.copyBadgeText}>Tap to copy</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* How it works */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>How it works</Text>
          <View style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
            <Text style={styles.stepText}>Share your code with a friend</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
            <Text style={styles.stepText}>They sign up and complete a booking</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
            <Text style={styles.stepText}>You both get $10 credit automatically</Text>
          </View>
        </View>

        {/* Stats card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Friends joined</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>$0</Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
        </View>

        {/* Bottom CTA zone */}
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleShare}
          activeOpacity={0.85}
        >
          <Feather name="share-2" size={18} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={styles.shareBtnText}>Share my code</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 16,
  },
  glowOrb: {
    position: 'absolute',
    top: -40,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,92,0,0.08)',
  },
  heroSection: {
    alignItems: 'center',
    gap: 12,
    paddingBottom: 8,
  },
  giftIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,92,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftIcon: {
    fontSize: 34,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 32,
  },
  heroBody: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  // Code card — dominant focal point
  codeCard: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.30)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  codeTouchable: {
    alignItems: 'center',
    gap: 8,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 4,
  },
  copyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,92,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.20)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  copyBadgeText: {
    fontSize: 12,
    color: '#FF8C42',
    fontWeight: '600',
  },
  stepsCard: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  stepsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,92,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF8C42',
  },
  stepText: {
    fontSize: 14,
    color: '#f0ede8',
    flex: 1,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 16,
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#1a1d1f',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF5C00',
    borderRadius: 14,
    paddingVertical: 16,
    minHeight: 54,
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    marginTop: 4,
  },
  shareBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
});
