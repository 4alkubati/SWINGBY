// Client Profile — walkthrough items D1, D8, D11.
//
// D1: the shipped screen was a centred "identity card" (avatar + name + email
// + role pill stacked in a bordered box) over one flat menu list — Kira's
// "looks like it's made in 2010". The mock is a left-aligned header row under
// a purple glow, then TWO grouped blocks.
//
// D8: the "Edit" affordance opened an inline edit mode on THIS screen with
// first/last/phone and no avatar. That inline mode is gone; Edit now pushes
// `ProfileEdit`, which already has the working avatar upload
// (POST /uploads/image + PATCH /auth/me). No new screen, no new endpoint —
// the working one was simply never reachable from here.
//
// D11: the Notifications row is gone. Notifications live in the home header
// bell only. `NotificationsCenter` stays registered in the navigator and is
// still reachable from that bell — only this entry point is removed.
//
// No data-fetching change: everything still comes from AuthContext.
import {
  View, StyleSheet, Alert, ScrollView, ActivityIndicator, Platform, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import Avatar from '../../components/Avatar';
import HeaderGlow from '../../components/HeaderGlow';
import { SkeletonBox } from '../../components/Skeleton';
import i18n from '../../i18n';

const ROLE_LABEL = {
  client: 'Client',
  business_owner: 'Business Owner',
  employee: 'Employee',
};

function memberSince(user) {
  if (!user?.created_at) return null;
  const d = new Date(user.created_at);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
}

// ─── Menu row ────────────────────────────────────────────────────────────────
// `icon` is optional on purpose: block 1 in the mock carries 34px tinted icon
// tiles, block 2 is label-only. Rows are 15px vertical (POLISH-TIPS §4) and
// separated by borderSubtle — the darker divider used inside grouped blocks.
function MenuRow({ icon, label, onPress, badge, last }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        !last && styles.menuRowDivided,
        pressed && styles.menuRowPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
    >
      {icon ? (
        <View style={styles.menuIconTile}>
          <Feather name={icon} size={17} strokeWidth={1.8} color={colors.textSecondary} />
        </View>
      ) : null}
      <Text style={styles.menuLabel} numberOfLines={1}>{label}</Text>
      {badge ? (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Feather name="chevron-right" size={17} strokeWidth={1.8} color={colors.textTertiary} />
    </Pressable>
  );
}

// ─── Loading state ───────────────────────────────────────────────────────────
// AuthContext can hand us a null user for a frame on cold start / token
// refresh. POLISH-TIPS §8: the skeleton matches the real geometry exactly.
function ProfileSkeleton() {
  return (
    <View style={styles.content}>
      <View style={styles.identityRow}>
        <SkeletonBox width={68} height={68} borderRadius={34} />
        <View style={styles.identityText}>
          <SkeletonBox width={150} height={22} borderRadius={6} />
          <SkeletonBox width={190} height={13} borderRadius={6} style={{ marginTop: spacing.sm }} />
        </View>
      </View>
      <SkeletonBox width="100%" height={186} borderRadius={radius.card} style={{ marginTop: 22 }} />
      <SkeletonBox width="100%" height={244} borderRadius={radius.card} style={{ marginTop: 14 }} />
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function confirmLogout() {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) {
        setLoggingOut(true);
        await logout();
      }
      return;
    }
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => { setLoggingOut(true); await logout(); },
      },
    ]);
  }

  const fullName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
  const since = memberSince(user);
  const subtitle = [ROLE_LABEL[user?.role] || user?.role, since && `Member since ${since}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Sanctioned glow moment (README §10a) — faint purple radial behind the
          header, absolutely positioned, non-interactive. */}
      <HeaderGlow width={420} height={300} offsetTop={-120} align="center" opacity={0.22} />

      {!user ? (
        <ProfileSkeleton />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        >
          {/* ── Identity row ── */}
          <Animated.View entering={FadeInDown.duration(240).delay(40)} style={styles.identityRow}>
            <Avatar name={fullName || '?'} source={user?.avatar_url} size={68} />
            <View style={styles.identityText}>
              <Text style={styles.name} numberOfLines={1}>
                {fullName || user?.email || '—'}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('ProfileEdit')}
              style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </Animated.View>

          {/* ── Block 1 ──
              Mock order is Favourites / Notifications / Payment methods /
              Invite friends. Notifications is dropped per D11.
              "Payments" rather than the mock's "Payment methods": there is no
              saved-card endpoint on the backend, and PaymentMethodScreen was
              deliberately rewritten to explain how escrow works instead of
              faking a card wallet. Labelling it "Payment methods" would
              promise a wallet that does not exist. */}
          <Animated.View entering={FadeInDown.duration(240).delay(100)} style={styles.block}>
            {user?.role === 'client' && (
              <MenuRow icon="heart" label="Favorites" onPress={() => navigation.navigate('Favorites')} />
            )}
            <MenuRow icon="credit-card" label="Payments" onPress={() => navigation.navigate('PaymentMethod')} />
            {user?.role === 'client' && (
              <MenuRow
                icon="gift"
                label="Invite friends"
                badge={i18n.t('profile.inviteBadge')}
                onPress={() => navigation.navigate('ReferralScreen')}
                last
              />
            )}
          </Animated.View>

          {/* ── Block 2 — Settings / Help / Privacy / Terms ── */}
          <Animated.View entering={FadeInDown.duration(240).delay(160)} style={styles.block}>
            {/* F025 — NotificationsCenter is registered in ClientNavigator but
                only BusinessProfileScreen ever navigated to it, so a client
                could never reach their own notification history. Same row the
                business side has (BusinessProfileScreen: "Notifications"). */}
            <MenuRow label="Notifications" onPress={() => navigation.navigate('NotificationsCenter')} />
            <MenuRow label="Settings" onPress={() => navigation.navigate('Settings')} />
            <MenuRow label="Help & FAQ" onPress={() => navigation.navigate('HelpFAQ')} />
            <MenuRow label="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} />
            <MenuRow label="Terms of Service" onPress={() => navigation.navigate('TermsOfService')} last />
          </Animated.View>

          {/* ── Log out ── */}
          <Animated.View entering={FadeInDown.duration(240).delay(220)}>
            <Pressable
              style={({ pressed }) => [
                styles.logoutBtn,
                pressed && styles.menuRowPressed,
                loggingOut && styles.logoutBtnDisabled,
              ]}
              onPress={confirmLogout}
              disabled={loggingOut}
              accessibilityRole="button"
              accessibilityLabel="Log out"
              accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
            >
              {loggingOut ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={styles.logoutText}>Log out</Text>
              )}
            </Pressable>
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },

  // ── Identity ──
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  identityText: { flex: 1, gap: 3 },
  name: {
    fontSize: 22,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  editBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    minHeight: 36,
    justifyContent: 'center',
  },
  editBtnPressed: { backgroundColor: colors.surfaceAlt, opacity: 0.9 },
  editBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.textPrimary },

  // ── Grouped blocks ──
  block: {
    marginTop: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: spacing.base,
    paddingVertical: 15,
    minHeight: 52,
  },
  menuRowDivided: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  menuRowPressed: { backgroundColor: colors.surfaceAlt },
  menuIconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  menuBadge: {
    backgroundColor: colors.accentTint,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  menuBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.accentText },

  // ── Log out ──
  logoutBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnDisabled: { opacity: 0.4 },
  logoutText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.danger },
});
