import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function JobOpportunityCard({ post, onSendQuote }) {
  const clientName = post.client_name || post.client_first_name || 'Client';
  const date = post.preferred_date
    ? new Date(post.preferred_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    : null;
  const time = post.preferred_time || null;

  return (
    <View style={styles.container}>
      {/* Client row */}
      <View style={styles.clientRow}>
        <View style={styles.clientAvatar}>
          <Text style={styles.clientInitials}>{initials(clientName)}</Text>
        </View>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{clientName}</Text>
          <Text style={styles.category}>{post.category || 'General'}</Text>
        </View>
        {post.distance_km != null && (
          <View style={styles.distPill}>
            <Text style={styles.distText}>📍 {Number(post.distance_km).toFixed(1)} km</Text>
          </View>
        )}
      </View>

      {/* Description */}
      <Text style={styles.desc} numberOfLines={2} allowFontScaling={true}>{post.title || post.description || 'Job details'}</Text>

      {/* Meta row */}
      <View style={styles.metaRow}>
        <Text style={styles.budget}>
          {post.budget ? `$${post.budget}` : 'Open budget'}
        </Text>
        {(date || time) && (
          <Text style={styles.datetime}>
            {date}{date && time ? ' · ' : ''}{time}
          </Text>
        )}
      </View>

      {/* Send Quote button */}
      <TouchableOpacity
        style={styles.quoteBtn}
        onPress={onSendQuote}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Send quote for ${post.title || post.description || 'this job'}`}
        accessibilityHint="Opens a form to submit your quote"
      >
        <Text style={styles.quoteBtnText} allowFontScaling={true} maxFontSizeMultiplier={1.3}>Send Quote</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a2a3a',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientInitials: { fontSize: 12, fontWeight: '700', color: '#60a5fa' },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  category: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  distPill: {
    backgroundColor: '#131618',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  distText: { fontSize: 10, color: '#9ca3af', fontWeight: '600' },
  desc: { fontSize: 14, color: '#f0ede8', lineHeight: 20 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budget: { fontSize: 16, fontWeight: '700', color: '#FF5C00' },
  datetime: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  quoteBtn: {
    backgroundColor: '#FF5C00',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  quoteBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
