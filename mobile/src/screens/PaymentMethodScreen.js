// T68 — PaymentMethodScreen (Stripe placeholder)
// Shows an empty payment methods list with a "coming soon" stub.
// Full Stripe CardField integration will be wired once stripe-react-native
// is added to the project and backend webhook handlers are ready.
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as toast from '../services/toast';
import EmptyState from '../components/EmptyState';

export default function PaymentMethodScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const handleAddCard = () => {
    toast.show({
      type: 'info',
      text1: 'Coming soon',
      text2: 'Stripe integration is coming — please pay outside the app for now.',
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment method</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Stripe placeholder card */}
        <View style={styles.stripeCard}>
          <View style={styles.stripeTop}>
            <Feather name="credit-card" size={28} color="#6b7280" />
            <View style={styles.stripeBadge}>
              <Text style={styles.stripeBadgeText}>COMING SOON</Text>
            </View>
          </View>

          <Text style={styles.stripeTitle}>Stripe Payments</Text>
          <Text style={styles.stripeBody}>
            Secure in-app payments powered by Stripe will be available soon.
            Cards, Apple Pay and Google Pay will all be supported.
          </Text>

          {/* Fake card row (disabled appearance) */}
          <View style={styles.fakeCardRow}>
            <View style={styles.fakeCardChip} />
            <View style={styles.fakeCardNumbersWrap}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.fakeCardGroup} />
              ))}
              <Text style={styles.fakeCardLast}>•••• ••••</Text>
            </View>
          </View>
        </View>

        {/* Empty list */}
        <Text style={styles.sectionLabel}>Saved cards</Text>

        <View style={styles.emptyListWrap}>
          <EmptyState
            icon="credit-card"
            title="No payment methods on file yet"
            body="Add a card when Stripe integration launches."
          />
        </View>

        {/* Add card CTA */}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={handleAddCard}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={18} color="#ffffff" />
          <Text style={styles.addBtnText}>Add card</Text>
        </TouchableOpacity>

        {/* Footer notice */}
        <Text style={styles.footer}>
          All bookings are currently cash or e-transfer until we launch payment integration.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1d1f',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3 },

  scroll: { paddingHorizontal: 20, paddingTop: 20, gap: 18, paddingBottom: 40 },

  stripeCard: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 20,
    padding: 20,
    gap: 10,
    opacity: 0.85,
  },
  stripeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stripeBadge: {
    backgroundColor: '#131618',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stripeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 1.0,
  },
  stripeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: -0.3,
  },
  stripeBody: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
  },

  fakeCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#131618',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#1a1d1f',
  },
  fakeCardChip: {
    width: 28,
    height: 20,
    borderRadius: 5,
    backgroundColor: '#2a2e33',
  },
  fakeCardNumbersWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fakeCardGroup: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2a2e33',
  },
  fakeCardLast: {
    fontSize: 13,
    color: '#3a424c',
    fontWeight: '600',
    letterSpacing: 1,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: -8,
  },

  emptyListWrap: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 18,
    paddingVertical: 8,
    minHeight: 160,
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.35)',
    borderRadius: 14,
    paddingVertical: 15,
    minHeight: 50,
    opacity: 0.65, // visually disabled
  },
  addBtnText: { fontSize: 15, fontWeight: '700', color: '#FF8C42' },

  footer: {
    fontSize: 12,
    color: '#3a424c',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
});
