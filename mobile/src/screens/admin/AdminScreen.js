import { useCallback, useState } from 'react';
import { ScrollView, View, StyleSheet, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';

import Text from '../../components/Text';
import Button from '../../components/Button';
import Surface from '../../components/Surface';
import Inline from '../../components/Inline';
import { api } from '../../services/api';
import { colors, spacing, radius } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';

// NOTE: web/admin is not deployed — swingbyy.com still serves the pre-launch site
// and has not built from this repo since June (docs/DEPLOY.md). This link is
// therefore aspirational, which is exactly why refund decisions had to live in the
// app rather than behind it.
const WEB_ADMIN_URL = 'https://swingbyy.com/admin';

export default function AdminScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [pending, setPending] = useState(0);
  const [moneyHolds, setMoneyHolds] = useState(0);

  // Refreshed on focus so the badge is right when you come back from deciding one.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const res = await api.get('/disputes/admin/queue');
          const items = res?.items || [];
          if (alive) {
            setPending(res?.count ?? items.length);
            // needs_money_decision is per-item (backend/app/api/disputes.py) —
            // only cancellation_refund cases hold money; a poor_quality or
            // "other" complaint sitting in the same queue does not.
            setMoneyHolds(items.filter((i) => i.needs_money_decision).length);
          }
        } catch {
          // A dead count must not break the screen — the queue itself reports
          // its own errors.
          if (alive) {
            setPending(0);
            setMoneyHolds(0);
          }
        }
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

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
          <Text style={styles.eyebrow}>Swingbyy</Text>
          <Text style={styles.title}>Admin</Text>
          <Text style={styles.subtitle}>
            Signed in as {user?.first_name || 'admin'} ({user?.email})
          </Text>
        </Animated.View>

        <Surface style={styles.card}>
          <Inline justify="space-between" align="center">
            <Text style={styles.cardTitle}>Awaiting your decision</Text>
            {pending > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{pending}</Text>
              </View>
            )}
          </Inline>
          <Text style={styles.cardBody}>
            {pending > 0
              ? `${pending} ${pending === 1 ? 'case needs' : 'cases need'} a call.` +
                (moneyHolds > 0
                  ? ` ${moneyHolds} ${moneyHolds === 1 ? 'is' : 'are'} holding the client's money until you approve or decline the refund — decide from the before/after photos and the voice memo.`
                  : ' None of these are holding money right now — they're record-keeping complaints to review.')
              : 'Nothing waiting. When a job is cancelled after work started, the refund lands here for you to approve or decline.'}
          </Text>
          <View style={styles.cardAction}>
            <Button
              label={pending > 0 ? `Review ${pending}` : 'Open queue'}
              onPress={() => navigation.navigate('RefundQueue')}
            />
          </View>
        </Surface>

        {/* Guideline 1.2 commits us to acting on reports within 24 hours, so
            the queue needs a door on the admin home rather than only a route.
            No count badge: unlike refunds there is no cheap "how many are
            waiting" endpoint, and a badge that lies is worse than none. */}
        <Surface style={styles.card}>
          <Text style={styles.cardTitle}>Reported content</Text>
          <Text style={styles.cardBody}>
            Messages, reviews, posts and people that someone flagged. Hide the content
            or suspend the account from here — Apple expects reports to be acted on
            within a day, and this is where that happens.
          </Text>
          <View style={styles.cardAction}>
            <Button
              label="Open reports"
              variant="secondary"
              onPress={() => navigation.navigate('ReportQueue')}
            />
          </View>
        </Surface>

        <Surface style={styles.card}>
          <Text style={styles.cardTitle}>Everything else is on the web</Text>
          <Text style={styles.cardBody}>
            User management, business verification, payouts and bulk actions live in the
            web panel. Refund decisions are here because they need the photos and the
            voice memo, which is a phone job.
          </Text>
          <View style={styles.cardAction}>
            <Button label="Open web admin" variant="secondary" onPress={openWebAdmin} />
          </View>
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
  countBadge: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  countText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    color: colors.textPrimary,
  },
});
