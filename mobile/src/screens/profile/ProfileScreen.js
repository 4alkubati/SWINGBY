import {
  View, TouchableOpacity, StyleSheet, Alert, ScrollView,
  ActivityIndicator, TextInput, Platform, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { updateMe } from '../../services/auth';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import Button from '../../components/Button';
import i18n from '../../i18n';

function initials(user) {
  if (!user) return '?';
  return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
}

const ROLE_LABEL = {
  client: 'Client',
  business_owner: 'Business Owner',
  employee: 'Employee',
};

function MenuRow({ icon, label, onPress, danger, badge }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
    >
      <View style={styles.menuLeft}>
        <Feather name={icon} size={20} strokeWidth={1.8} color={danger ? colors.danger : colors.textSecondary} />
        <Text style={[styles.menuLabel, danger && { color: colors.danger }]}>{label}</Text>
      </View>
      <View style={styles.menuRight}>
        {badge ? (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{badge}</Text>
          </View>
        ) : null}
        <Feather name="chevron-right" size={18} strokeWidth={1.8} color={colors.textSecondary} />
      </View>
    </Pressable>
  );
}

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(user?.phone || '');

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

  function startEdit() {
    setFirstName(user?.first_name || '');
    setLastName(user?.last_name || '');
    setPhone(user?.phone || '');
    setEditMode(true);
  }

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      if (Platform.OS === 'web') {
        window.alert('First and last name cannot be blank.');
      } else {
        Alert.alert('Required', 'First and last name cannot be blank.');
      }
      return;
    }
    setSaving(true);
    try {
      const payload = { first_name: firstName.trim(), last_name: lastName.trim() };
      if (phone.trim()) payload.phone = phone.trim();
      const res = await updateMe(payload);
      updateUser(res.user || payload);
      setEditMode(false);
    } catch (err) {
      if (Platform.OS === 'web') {
        window.alert(err.message || 'Could not save changes.');
      } else {
        Alert.alert('Error', err.message || 'Could not save changes.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
          Profile
        </Text>
        <View style={styles.headerRight}>
          {!editMode && (
            <TouchableOpacity onPress={startEdit} style={styles.editBtn} accessibilityRole="button" accessibilityLabel="Edit profile">
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Identity card */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)} style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user)}</Text>
          </View>

          {editMode ? (
            <View style={styles.editFields}>
              <View style={styles.editRow}>
                <View style={styles.editHalf}>
                  <Text style={styles.editLabel}>First name</Text>
                  <TextInput
                    style={styles.editInput}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="First"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.editHalf}>
                  <Text style={styles.editLabel}>Last name</Text>
                  <TextInput
                    style={styles.editInput}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Last"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>
              <Text style={styles.editLabel}>Phone</Text>
              <TextInput
                style={styles.editInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 403 555 0100"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
              />
            </View>
          ) : (
            <>
              <Text style={styles.name} maxFontSizeMultiplier={1.4}>
                {user?.first_name} {user?.last_name}
              </Text>
              <Text style={styles.email} maxFontSizeMultiplier={1.4}>{user?.email}</Text>
            </>
          )}

          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{ROLE_LABEL[user?.role] || user?.role}</Text>
          </View>
        </Animated.View>

        {editMode ? (
          <View style={styles.editActions}>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" label="Cancel" onPress={() => setEditMode(false)} />
            </View>
            <View style={{ flex: 2 }}>
              <Button label="Save changes" onPress={handleSave} loading={saving} disabled={saving} />
            </View>
          </View>
        ) : (
          <>
            {/* Info rows */}
            <Animated.View entering={FadeInDown.duration(400).delay(160)} style={styles.infoCard}>
              {user?.phone && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{user.phone}</Text>
                </View>
              )}
              <View style={[styles.infoRow, !user?.phone && styles.infoRowFirst]}>
                <Text style={styles.infoLabel}>Member since</Text>
                <Text style={styles.infoValue}>
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
                    : '—'}
                </Text>
              </View>
            </Animated.View>

            {/* Menu */}
            <Animated.View entering={FadeInDown.duration(400).delay(240)} style={styles.menuCard}>
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
                />
              )}
              <MenuRow icon="settings" label="Settings" onPress={() => navigation.navigate('Settings')} />
              <MenuRow icon="help-circle" label="Help & FAQ" onPress={() => navigation.navigate('HelpFAQ')} />
              <MenuRow icon="shield" label="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} />
              <MenuRow icon="file-text" label="Terms of Service" onPress={() => navigation.navigate('TermsOfService')} />
            </Animated.View>

            {/* Logout */}
            <Animated.View entering={FadeInDown.duration(400).delay(320)}>
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
                  : (
                    <View style={styles.logoutInner}>
                      <Feather name="log-out" size={18} strokeWidth={1.8} color={colors.danger} />
                      <Text style={styles.logoutText}>Log out</Text>
                    </View>
                  )}
              </TouchableOpacity>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 22, fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.textPrimary, letterSpacing: -0.5,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  editBtn: {
    backgroundColor: colors.accentMuted, borderRadius: radius.chip,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
  },
  editBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.accentText },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.base },

  identityCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.card, padding: spacing.lg, alignItems: 'center', gap: spacing.sm,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 26, fontFamily: 'SpaceGrotesk_700Bold', color: colors.accentText },
  name: { fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary },
  email: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  rolePill: {
    backgroundColor: colors.accentMuted, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  roleText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.accentText },

  editFields: { width: '100%', gap: spacing.sm },
  editRow: { flexDirection: 'row', gap: spacing.sm },
  editHalf: { flex: 1, gap: spacing.xs },
  editLabel: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: spacing.xs,
  },
  editInput: {
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.input, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textPrimary,
  },
  editActions: { flexDirection: 'row', gap: spacing.sm },

  infoCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.card, overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.base, paddingVertical: spacing.md + 1,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  infoRowFirst: { borderTopWidth: 0 },
  infoLabel: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  infoValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.textPrimary },

  menuCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.card, overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.base, paddingVertical: spacing.md + 2,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  menuRowPressed: { backgroundColor: colors.surfaceAlt },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuLabel: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.textPrimary },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  menuBadge: {
    backgroundColor: colors.accentMuted, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  menuBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.accentText },

  logoutBtn: {
    borderWidth: 1, borderColor: colors.danger,
    backgroundColor: colors.surface, borderRadius: radius.button,
    paddingVertical: 15, alignItems: 'center', marginTop: spacing.xs,
  },
  logoutBtnDisabled: { opacity: 0.5 },
  logoutInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoutText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.danger },
});
