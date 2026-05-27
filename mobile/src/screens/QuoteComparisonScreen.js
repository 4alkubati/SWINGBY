import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import QuoteCard from '../components/QuoteCard';

export default function QuoteComparisonScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { postId, postTitle } = route.params || {};
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get(`/interests/post/${postId}`);
        // sort: score = rating / price (higher is better)
        const sorted = (data || []).sort((a, b) => {
          const scoreA = (a.avg_rating || 0) / (a.quoted_price || 1);
          const scoreB = (b.avg_rating || 0) / (b.quoted_price || 1);
          return scoreB - scoreA;
        });
        setQuotes(sorted);
      } catch {
        // keep empty
      } finally {
        setLoading(false);
      }
    })();
  }, [postId]);

  async function handleSelect(quote) {
    Alert.alert(
      'Confirm selection',
      `Book ${quote.business_name || 'this business'} for $${quote.quoted_price}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: async () => {
            setConfirming(true);
            try {
              const booking = await api.patch(`/interests/${quote.id}/accept`);
              navigation.replace('ActiveBooking', {
                bookingId: booking?.booking_id || booking?.id,
              });
            } catch (err) {
              Alert.alert('Error', err.message || 'Could not confirm booking.');
            } finally {
              setConfirming(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#FF5C00" size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{quotes.length} businesses quoted</Text>
          {postTitle && <Text style={styles.headerSub} numberOfLines={1}>{postTitle}</Text>}
        </View>
        <View style={{ width: 32 }} />
      </View>

      {quotes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>⏳</Text>
          <Text style={styles.emptyTitle}>No quotes yet</Text>
          <Text style={styles.emptyDesc}>Businesses will respond shortly. Check back in a few minutes.</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <Text style={styles.hint}>Sorted by best rating × price. Tap a name to view profile.</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsRow}>
            {quotes.map((quote, index) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                isRecommended={index === 0}
                onSelect={() => handleSelect(quote)}
                onViewProfile={() =>
                  navigation.navigate('BusinessProfile', { businessId: quote.business_id })
                }
              />
            ))}
          </ScrollView>
        </ScrollView>
      )}

      {confirming && (
        <Modal transparent animationType="fade">
          <View style={styles.confirmingOverlay}>
            <ActivityIndicator color="#FF5C00" size="large" />
            <Text style={styles.confirmingText}>Creating booking…</Text>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },
  loader: { flex: 1, backgroundColor: '#07080a', alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22,
    paddingTop: 12, paddingBottom: 16,
  },
  back: { fontSize: 24, color: '#9ca3af', width: 32 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  headerSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  content: { paddingBottom: 32 },
  hint: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginHorizontal: 22, marginBottom: 16 },
  cardsRow: { paddingHorizontal: 22, gap: 12 },
  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  emptyDesc: { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 20 },
  confirmingOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  confirmingText: { fontSize: 16, color: '#ffffff', fontWeight: '500' },
});
