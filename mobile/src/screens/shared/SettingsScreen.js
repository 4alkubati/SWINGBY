// T51 — SettingsScreen (UX polish pass)
import React, { useState, useEffect } from 'react';
import {
  View, ScrollView, StyleSheet,
  Switch, Alert, Share, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';

// expo-notifications is lazy-required (see services/notifications.js for the
// full explanation). Imported here only inside handlers, never at module load.
const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { show as showToast } from '../../services/toast';
import LanguageSelector from '../../components/LanguageSelector';
import {
  isBiometricEnabled,
  setBiometricEnabled,
  isBiometricHardwareReady,
  authenticateAsync,
} from '../../services/biometrics';
import i18n from '../../i18n';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import Stack from '../../components/Stack';
import Surface from '../../components/Surface';
import Button from '../../components/Button';
import ListItem from '../../components/ListItem';

const APP_VERSION =
  Constants.expoConfig?.version ??
  Constants.manifest?.version ??
  Constants.manifest2?.extra?.expoClient?.version ??
  '1.0.0';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  const [notifEnabled, setNotifEnabled] = useState(false);
  const [langVisible, setLangVisible] = useState(false);
  const [currentLocale, setCurrentLocale] = useState(i18n.locale);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  // CARD-24 — biometric unlock toggle. Off by default; only flips on after
  // the device proves it actually has biometrics enrolled AND the user
  // passes one confirmation prompt (so a stale/mistaken toggle can't lock
  // anyone out later — see BiometricLockScreen's fallback for the boot side).
  const [bioEnabled, setBioEnabledState] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    if (isExpoGo) return;
    try {
      const Notifications = require('expo-notifications');
      Notifications.getPermissionsAsync().then(({ status }) => {
        setNotifEnabled(status === 'granted');
      }).catch(() => {});
    } catch {
      // Native module unavailable — leave switch off.
    }
  }, []);

  useEffect(() => {
    isBiometricEnabled().then(setBioEnabledState);
  }, []);

  async function toggleBiometric(val) {
    if (!val) {
      // Turning off never needs a check — always safe.
      setBioEnabledState(false);
      await setBiometricEnabled(false);
      return;
    }
    setBioBusy(true);
    try {
      const ready = await isBiometricHardwareReady();
      if (!ready) {
        Alert.alert(
          i18n.t('security.biometricUnavailableTitle'),
          i18n.t('security.biometricUnavailableBody')
        );
        return; // toggle stays off — graceful degrade, no lockout
      }
      // Confirm they can actually unlock before persisting the opt-in.
      const result = await authenticateAsync(i18n.t('biometricLock.promptMessage'));
      if (result.success) {
        setBioEnabledState(true);
        await setBiometricEnabled(true);
      } else {
        showToast({ type: 'error', text1: i18n.t('security.biometricConfirmFailed') });
      }
    } finally {
      setBioBusy(false);
    }
  }

  async function toggleNotifications(val) {
    if (isExpoGo) {
      // Expo Go can't grant push perms. Silently no-op the toggle.
      return;
    }
    try {
      const Notifications = require('expo-notifications');
      if (val) {
        const { status } = await Notifications.requestPermissionsAsync();
        setNotifEnabled(status === 'granted');
      } else {
        setNotifEnabled(false);
      }
    } catch {
      setNotifEnabled(false);
    }
  }

  async function handleExportData() {
    setExportLoading(true);
    try {
      const result = await api.get('/me/export');
      const content = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
      await Share.share({ message: content, title: 'My SwingBy Data' });
    } catch (err) {
      showToast({ type: 'error', text1: 'Export failed', text2: err.message });
    } finally {
      setExportLoading(false);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ]
    );
  }

  async function confirmDeleteAccount() {
    setDeleteLoading(true);
    try {
      await api.delete('/me', { data: { confirm: 'DELETE_MY_ACCOUNT' } });
      await logout();
    } catch (err) {
      showToast({ type: 'error', text1: 'Could not delete account', text2: err.message });
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleContactUs() {
    import('react-native').then(({ Linking }) => {
      Linking.openURL('mailto:4alkubati@gmail.com');
    });
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  }

  // Locale chip displayed as the right slot on the Language row
  const localeChip = (
    <View style={styles.localeChip}>
      <Text variant="caption" style={styles.localeChipText}>
        {currentLocale === 'fr-CA' ? 'FR' : 'EN'}
      </Text>
    </View>
  );

  // Notifications toggle as the right slot (hides the default chevron)
  const notifSwitch = (
    <Switch
      value={notifEnabled}
      onValueChange={toggleNotifications}
      trackColor={{ false: colors.border, true: colors.accentMuted }}
      thumbColor={notifEnabled ? colors.accent : colors.textSecondary}
    />
  );

  // Biometric unlock toggle — off by default (CARD-24)
  const bioSwitch = bioBusy ? (
    <ActivityIndicator size="small" color={colors.accent} />
  ) : (
    <Switch
      value={bioEnabled}
      onValueChange={toggleBiometric}
      trackColor={{ false: colors.border, true: colors.accentMuted }}
      thumbColor={bioEnabled ? colors.accent : colors.textSecondary}
    />
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="display3">Settings</Text>
        {user && (
          <Text variant="body" color="secondary" style={styles.headerSub}>
            {user.first_name} {user.last_name} · {user.email}
          </Text>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Stack spacing="base">
          {/* ── ACCOUNT ── */}
          <Surface elevation="subtle" padding={0} style={styles.section}>
            <Text variant="label" color="secondary" style={styles.sectionLabel}>
              ACCOUNT
            </Text>
            <Stack spacing={0}>
              <ListItem
                left={<Feather name="user" size={24} color={colors.textSecondary} />}
                title="Edit profile"
                onPress={() => navigation.navigate('ProfileEdit')}
                style={styles.listItemFlush}
              />
              <View style={styles.divider} />
              <ListItem
                left={<Feather name="globe" size={24} color={colors.textSecondary} />}
                title="Language"
                onPress={() => setLangVisible(true)}
                right={localeChip}
                showChevron={false}
                style={styles.listItemFlush}
              />
              <View style={styles.divider} />
              <ListItem
                left={<Feather name="bell" size={24} color={colors.textSecondary} />}
                title="Notifications"
                right={notifSwitch}
                showChevron={false}
                style={styles.listItemFlush}
              />
            </Stack>
          </Surface>

          {/* ── SECURITY (CARD-24) ── */}
          <Surface elevation="subtle" padding={0} style={styles.section}>
            <Text variant="label" color="secondary" style={styles.sectionLabel}>
              {i18n.t('security.title')}
            </Text>
            <Stack spacing={0}>
              <ListItem
                left={<Feather name="lock" size={24} color={colors.textSecondary} />}
                title={i18n.t('security.biometricUnlock')}
                subtitle={i18n.t('security.biometricUnlockSub')}
                right={bioSwitch}
                showChevron={false}
                style={styles.listItemFlush}
              />
            </Stack>
          </Surface>

          {/* ── PRIVACY & LEGAL ── */}
          <Surface elevation="subtle" padding={0} style={styles.section}>
            <Text variant="label" color="secondary" style={styles.sectionLabel}>
              PRIVACY {'&'} LEGAL
            </Text>
            <Stack spacing={0}>
              <ListItem
                left={<Feather name="shield" size={24} color={colors.textSecondary} />}
                title="Privacy Policy"
                onPress={() => navigation.navigate('PrivacyPolicy')}
                style={styles.listItemFlush}
              />
              <View style={styles.divider} />
              <ListItem
                left={<Feather name="file-text" size={24} color={colors.textSecondary} />}
                title="Terms of Service"
                onPress={() => navigation.navigate('TermsOfService')}
                style={styles.listItemFlush}
              />
              <View style={styles.divider} />
              <ListItem
                left={<Feather name="download" size={24} color={colors.textSecondary} />}
                title="Export my data"
                onPress={exportLoading ? undefined : handleExportData}
                right={
                  exportLoading
                    ? <ActivityIndicator size="small" color={colors.accent} />
                    : undefined
                }
                showChevron={!exportLoading}
                style={[styles.listItemFlush, exportLoading && styles.rowDisabled]}
              />
              <View style={styles.divider} />
              <ListItem
                left={<Feather name="trash-2" size={24} color={colors.danger} />}
                title="Delete my account"
                onPress={deleteLoading ? undefined : handleDeleteAccount}
                right={
                  deleteLoading
                    ? <ActivityIndicator size="small" color={colors.danger} />
                    : undefined
                }
                showChevron={!deleteLoading}
                style={[styles.listItemFlush, deleteLoading && styles.rowDisabled]}
                titleStyle={{ color: colors.danger }}
              />
            </Stack>
          </Surface>

          {/* ── SUPPORT ── */}
          <Surface elevation="subtle" padding={0} style={styles.section}>
            <Text variant="label" color="secondary" style={styles.sectionLabel}>
              SUPPORT
            </Text>
            <Stack spacing={0}>
              <ListItem
                left={<Feather name="help-circle" size={24} color={colors.textSecondary} />}
                title="Help & FAQ"
                onPress={() => navigation.navigate('HelpFAQ')}
                style={styles.listItemFlush}
              />
              <View style={styles.divider} />
              <ListItem
                left={<Feather name="mail" size={24} color={colors.textSecondary} />}
                title="Contact us"
                onPress={handleContactUs}
                style={styles.listItemFlush}
              />
            </Stack>
          </Surface>

          {/* ── Sign out ── */}
          <Button
            variant="danger"
            label="Sign Out"
            onPress={handleSignOut}
            icon={<Feather name="log-out" size={16} color={colors.textPrimary} />}
          />

          {/* Version footer */}
          <Text variant="caption" color="secondary" style={styles.versionText}>
            SwingBy v{APP_VERSION}
          </Text>
        </Stack>
      </ScrollView>

      <LanguageSelector
        visible={langVisible}
        currentLocale={currentLocale}
        onClose={(code) => {
          setLangVisible(false);
          if (code) setCurrentLocale(code);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerSub: {
    marginTop: spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xl,
  },
  // Section card — Surface with no padding; label + rows rendered inside
  section: {
    overflow: 'hidden',
    borderRadius: radius.card,
  },
  sectionLabel: {
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontSize: 11,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  // Strip the ListItem's own card styling so rows sit flush inside Surface
  listItemFlush: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.base + 24 + spacing.sm,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  localeChip: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  localeChipText: {
    fontWeight: '700',
    color: colors.accentText,
    letterSpacing: 0.5,
  },
  versionText: {
    textAlign: 'center',
    paddingVertical: spacing.base,
  },
});
