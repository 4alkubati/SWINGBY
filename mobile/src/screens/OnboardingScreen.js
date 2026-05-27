import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  function goTo(role) {
    navigation.navigate('Signup', { role });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <Text style={styles.logo}>Swing<Text style={styles.dot}>By</Text></Text>
        <Text style={styles.tagline}>Calgary's service marketplace</Text>
      </View>

      <Text style={styles.question}>I'm here to…</Text>

      <View style={styles.cards}>
        {/* Client card */}
        <TouchableOpacity style={styles.card} onPress={() => goTo('client')} activeOpacity={0.85}>
          <Text style={styles.cardIcon}>🔍</Text>
          <Text style={styles.cardTitle}>Find a Service</Text>
          <Text style={styles.cardDesc}>
            Browse nearby businesses, post a job, and get quotes from pros in minutes.
          </Text>
          <View style={styles.cardCta}>
            <Text style={styles.cardCtaText}>I need a service →</Text>
          </View>
        </TouchableOpacity>

        {/* Business card */}
        <TouchableOpacity
          style={[styles.card, styles.cardBusiness]}
          onPress={() => goTo('business_owner')}
          activeOpacity={0.85}
        >
          <Text style={styles.cardIcon}>🛠</Text>
          <Text style={styles.cardTitle}>Offer Services</Text>
          <Text style={styles.cardDesc}>
            Get discovered by local clients, respond to job posts, and grow your business.
          </Text>
          <View style={[styles.cardCta, styles.cardCtaDark]}>
            <Text style={[styles.cardCtaText, styles.cardCtaTextDark]}>I offer services →</Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
        <Text style={styles.loginText}>Already have an account? <Text style={styles.loginAccent}>Log in</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080a',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  header: {
    paddingTop: 20,
    alignItems: 'center',
  },
  logo: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1.5,
    color: '#ffffff',
  },
  dot: {
    color: '#FF5C00',
  },
  tagline: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 6,
    fontWeight: '500',
  },
  question: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginTop: 32,
  },
  cards: {
    flex: 1,
    gap: 14,
    marginTop: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 0, 0.25)',
    borderRadius: 20,
    padding: 22,
    gap: 10,
  },
  cardBusiness: {
    borderColor: '#1a1d1f',
  },
  cardIcon: {
    fontSize: 32,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  cardDesc: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
  },
  cardCta: {
    backgroundColor: '#FF5C00',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  cardCtaDark: {
    backgroundColor: '#131618',
    borderWidth: 1,
    borderColor: '#2a2e33',
  },
  cardCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  cardCtaTextDark: {
    color: '#9ca3af',
  },
  loginLink: {
    alignItems: 'center',
    paddingTop: 16,
  },
  loginText: {
    fontSize: 14,
    color: '#6b7280',
  },
  loginAccent: {
    color: '#FF5C00',
    fontWeight: '600',
  },
});
