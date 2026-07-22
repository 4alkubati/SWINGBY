import {
  View, ScrollView, StyleSheet, Alert, Platform, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import Surface from '../../components/Surface';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Avatar from '../../components/Avatar';
import HeaderGlow from '../../components/HeaderGlow';
import i18n from '../../i18n';

const ROLE_LABEL = {
  client: 'Client',
  business_owner: 'Business Owner',
  employee: 'Employee',
};

// One list row inside a grouped card. Matches the approved MyJobs / handoff
// language: icon chip on the left, label, optional badge, chevron. Built on
// the design system (Feather + Text + tokens) rather than a bespoke component.
function MenuRow({ icon, label, onPress, badge, isLast }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      style={[styles.menuRow, isLast && styles.menuRowLast]}
    >
      <View style={styles.menuIconChip}>
        <Feather name={icon} size={16} strokeWidth={1.8} color={colors.accentText} />
      </View>
      <Text variant="body" style={styles.menuLabel}>{label}</Text>
      {badge ? (
        <View style={styles.menuBadge}>
          <Text variant="caption" style={styles.menuBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Feather name="chevron-right" size={16} strokeWidth={2} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const fullName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || '—';
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
    : null;

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
        text: 'Log out', style: 'destructive',
        onPress: async () => { setLoggingOut(true); await logout(); },
      },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <HeaderGlow align="center" offsetTop={-120} width={420} height={300} opacity={0.22} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {/* ── Identity row ── */}
        <Animated.View entering={FadeInDown.duration(400).delay(60)}>
          <Inline spacing="base" style={styles.identityRow}>
            <Avatar name={fullName} source={user?.avatar_url} size="lg" />
            <View style={styles.identityText}>
              <Text variant="display3" numberOfLines={1}>{fullName}</Text>
              <Text variant="small" color="secondary" numberOfLines={1}>
                {memberSince
                  ? `${ROLE_LABEL[user?.role] || user?.role} · Member since ${memberSince}`
                  : (ROLE_LABEL[user?.role] || user?.role)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('ProfileEdit')}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              style={styles.editBtn}
            >
              <Text variant="smallMedium">Edit</Text>
            </TouchableOpacity>
          </Inline>
        </Animated.View>

        {/* ── Primary menu group ── */}
        <Animated.View entering={FadeInDown.duration(400).delay(140)}>
          <Surface elevation="subtle" padding={0} style={styles.menuCard}>
            {user?.role === 'client' && (
              <MenuRow icon="heart" label="Favorites" onPress={() => navigation.navigate('Favorites')} />
            )}
            <MenuRow icon="bell" label="Notifications" onPress={() => navigation.navigate('NotificationsCenter')} />
            <MenuRow icon="credit-card" label="Payment methods" onPress={() => navigation.navigate('PaymentMethod')} />
            {user?.role === 'client' && (
              <MenuRow
                icon="gift"
                label="Invite friends"
                badge={i18n.t('profile.inviteBadge')}
                onPress={() => navigation.navigate('ReferralScreen')}
                isLast
              />
            )}
            {user?.role !== 'client' && (
              <MenuRow icon="settings" label="Settings" onPress={() => navigation.navigate('Settings')} isLast />
            )}
          </Surface>
        </Animated.View>

        {/* ── Secondary menu group ── */}
        <Animated.View entering={FadeInDown.duration(400).delay(220)}>
          <Surface elevation="subtle" padding={0} style={styles.menuCard}>
            {user?.role === 'client' && (
              <MenuRow icon="settings" label="Settings" onPress={() => navigation.navigate('Settings')} />
            )}
            <MenuRow icon="help-circle" label="Help & FAQ" onPress={() => navigation.navigate('HelpFAQ')} />
            <MenuRow icon="shield" label="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} />
            <MenuRow icon="file-text" label="Terms of Service" onPress={() => navigation.navigate('TermsOfService')} isLast />
          </Surface>
        </Animated.View>

        {/* ── Logout ── */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <TouchableOpacity
            style={[styles.logoutBtn, loggingOut && styles.logoutBtnDisabled]}
            onPress={confirmLogout}
            activeOpacity={0.8}
            disabled={loggingOut}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
          >
            {loggingOut
              ? <ActivityIndicator color={colors.danger} />
              : <Text variant="smallMedium" color="danger">Log out</Text>}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + spacing.md,
    gap: spacing.base,
  },

  identityRow: { paddingVertical: spacing.xs },
  identityText: { flex: 1, gap: 3 },
  editBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },

  menuCard: { overflow: 'hidden' },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md + 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuRowLast: { borderBottomWidth: 0 },
  menuIconChip: {
    width: 34, height: 34, borderRadius: radius.chip,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { flex: 1 },
  menuBadge: {
    backgroundColor: colors.accentMuted, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  menuBadgeText: { color: colors.accentText, fontWeight: '700' },

  logoutBtn: {
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, borderRadius: radius.input,
    paddingVertical: 15, alignItems: 'center',
  },
  logoutBtnDisabled: { opacity: 0.5 },
});
