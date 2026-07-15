import { SafeAreaView, ScrollView, View, StyleSheet, Linking, Alert } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import Text from '../../components/Text';
import Button from '../../components/Button';
import Surface from '../../components/Surface';
import { colors, spacing, radius } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';

const WEB_ADMIN_URL = 'https://swingbyy.com/admin';

export default function AdminScreen() {
  const { user, logout } = useAuth();

  async function openWebAdmin() {
    const supported = await Linking.canOpenURL(WEB_ADMIN_URL);
    if (supported) {
      await Linking.openURL(WEB_ADMIN_URL);
    } else {
      Alert.alert('Cannot open', `Open ${WEB_ADMIN_URL} on your computer instead.`);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(400).delay(80)}>
          <Text style={styles.eyebrow}>SwingBy</Text>
          <Text style={styles.title}>Admin</Text>
          <Text style={styles.subtitle}>
            Signed in as {user?.first_name || 'admin'} ({user?.email})
          </Text>
        </Animated.View>

        <Surface style={styles.card}>
          <Text style={styles.cardTitle}>Admin tools live on the web</Text>
          <Text style={styles.cardBody}>
            Open the SwingBy admin panel on your computer for user management, business
            verification, payouts, disputes, and bulk actions. Mobile is intentionally
            read-only for now.
          </Text>
          <View style={styles.cardAction}>
            <Button label="Open web admin" onPress={openWebAdmin} />
          </View>
        </Surface>

        <Surface style={styles.card}>
          <Text style={styles.cardTitle}>What's next on the roadmap</Text>
          <Text style={styles.cardBody}>
            A mobile admin dashboard will land after public launch. Until then, all
            moderation flows are web-only so audit trails stay clean.
          </Text>
        </Surface>

        <View style={styles.logoutWrap}>
          <Button label="Log out" variant="ghost" onPress={logout} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  eyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: colors.accentText,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 32,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.card,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  cardBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  cardAction: { marginTop: spacing.md },
  logoutWrap: { marginTop: spacing.lg },
});
