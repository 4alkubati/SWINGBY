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
import {
  isBiometricAvailable,
  getBiometricPref,
  setBiometricPref,
  authenticateAsync,
} from '../../services/biometrics';
import LanguageSelector from '../../components/LanguageSelector';
import i18n from '../../i18n';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import Stack from '../../components/Stack';
import Surface from '../../components/Surface';
import Button from '../../components/Button';
import ListItem from '../../components/ListItem';
import Modal from '../../components/Modal';
import TextField from '../../components/TextField';

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
  // Delete-account sheet (Guideline 5.1.1(v)). `needsPassword` decides whether
  // the sheet shows a password field at all — a Sign in with Apple account has
  // no password to ask for.
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(true);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState(null);

  // Ghost mode. The endpoints (POST /me/ghost, /me/unghost) and every
  // enforcement point behind them shipped weeks ago with NO caller — and
  // PrivacyPolicyScreen §3 promises the feature in writing. A privacy policy
  // describing a control the app does not expose is the kind of thing App
  // Review reads the policy to catch.
  const [ghosted, setGhosted] = useState(!!user?.is_ghosted);
  const [ghostBusy, setGhostBusy] = useState(false);

  // Credit balance (GET /me/credits — also previously uncalled). Credits are
  // granted when a BUSINESS cancels late or no-shows, so the person holding one
  // has already been let down once; not being able to see it is the second
  // letdown. `null` = not loaded, which is never rendered as $0.
  const [credit, setCredit] = useState(null);

  // CARD-24 — biometric unlock, opt-in and off by default.
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
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
    (async () => {
      const [available, pref] = await Promise.all([isBiometricAvailable(), getBiometricPref()]);
      setBioAvailable(available);
      // A pref saved on a device that later loses its enrollment shouldn't
      // show as "on" — but we don't erase the stored pref, so it silently
      // resumes if the user re-enrolls.
      setBioEnabled(available && pref);
    })();
  }, []);

  async function toggleBiometric(nextVal) {
    if (bioBusy) return;
    if (!nextVal) {
      setBioBusy(true);
      await setBiometricPref(false);
      setBioEnabled(false);
      setBioBusy(false);
      return;
    }
    if (!bioAvailable) {
      Alert.alert(
        i18n.t('settings.biometricUnavailableTitle'),
        i18n.t('settings.biometricUnavailableBody')
      );
      return;
    }
    setBioBusy(true);
    const result = await authenticateAsync(i18n.t('settings.biometricConfirmPrompt'));
    if (result.success) {
      await setBiometricPref(true);
      setBioEnabled(true);
    }
    setBioBusy(false);
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

  useEffect(() => {
    let alive = true;
    api
      .get('/me/credits')
      .then((res) => {
        if (alive) setCredit(res?.balance_cents ?? res?.data?.balance_cents ?? 0);
      })
      .catch(() => { /* a settings screen must open without it */ });
    return () => { alive = false; };
  }, []);

  async function handleGhostToggle(next) {
    if (ghostBusy) return;
    setGhostBusy(true);
    try {
      await api.post(next ? '/me/ghost' : '/me/unghost', {});
      setGhosted(next);
      showToast({
        type: 'success',
        text1: i18n.t(next ? 'settings.ghostOn' : 'settings.ghostOff'),
      });
    } catch (err) {
      // 409 carries the specific reasons — an active booking, money still in
      // escrow, an open dispute. Those are the only answers worth giving: a
      // generic "could not" leaves the person with no idea what to finish
      // first.
      const reasons = err?.response?.data?.detail?.reasons;
      showToast({
        type: 'error',
        text1: i18n.t('settings.ghostFailed'),
        text2: Array.isArray(reasons) && reasons.length
          ? reasons.join(' · ')
          : undefined,
      });
    } finally {
      setGhostBusy(false);
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

  // ── Delete account (App Store Guideline 5.1.1(v)) ──────────────────────────
  //
  // This used to be a bare Alert that POSTed `{ confirm }` and nothing else,
  // against a backend that REQUIRED a password — so every tap 422'd and the
  // account was never deleted. Two things fix it: the backend now asks for a
  // password only when the account has one, and this sheet collects it when it
  // does.
  //
  // The copy also used to say "permanently delete your account and all data",
  // which was false. It is a soft delete: the profile is scrubbed and the
  // account is locked out, but bookings, payments and invoices are retained for
  // six years because the CRA requires it — exactly as PrivacyPolicyScreen §3
  // says. Telling a user their financial records are gone when they are not is
  // the kind of thing App Review reads the privacy policy to catch.
  async function handleDeleteAccount() {
    setDeletePassword('');
    setDeleteError(null);
    // Ask the backend which shape this sheet takes. Defaults to asking for a
    // password if the call fails — the safe direction, and it matches the
    // backend's own fail-closed posture in me.py::_has_password_identity.
    setNeedsPassword(true);
    setDeleteVisible(true);
    try {
      const res = await api.get('/me/auth-methods');
      setNeedsPassword(res?.data?.has_password !== false);
    } catch {
      setNeedsPassword(true);
    }
  }

  async function confirmDeleteAccount() {
    if (deleteLoading) return;
    if (needsPassword && !deletePassword) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await api.delete('/me', {
        data: {
          confirm: 'DELETE_MY_ACCOUNT',
          ...(needsPassword ? { password: deletePassword } : {}),
        },
      });
      setDeleteVisible(false);
      showToast({ type: 'success', text1: i18n.t('settings.deleteAccountDone') });
      await logout();
    } catch (err) {
      // 401 is specifically "that password was wrong", and saying so beats a
      // generic failure the user cannot act on.
      setDeleteError(
        err?.response?.status === 401
          ? i18n.t('settings.deleteAccountWrongPassword')
          : i18n.t('settings.deleteAccountFailed'),
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleContactUs() {
    import('react-native').then(({ Linking }) => {
      // Guideline 1.2(d) wants published contact information for a UGC app. A
      // personal Gmail in the shipping binary, next to a different support URL
      // in App Store Connect, is the kind of mismatch that reads as careless.
      Linking.openURL('mailto:support@swingbyy.com');
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
              <View style={styles.divider} />
              <ListItem
                left={<Feather name="lock" size={24} color={colors.textSecondary} />}
                title={i18n.t('settings.biometricUnlock')}
                subtitle={bioAvailable ? undefined : i18n.t('settings.biometricUnavailableHint')}
                right={bioSwitch}
                showChevron={false}
                style={styles.listItemFlush}
              />
            </Stack>
          </Surface>

          {/* ── SAFETY ──
              App Store Guideline 1.2(c) asks for a way to block abusive users.
              Blocking itself happens in context (a chat header, a profile);
              this is where you UNDO it, which is the half that has nowhere
              else to live. A reviewer looking for "how do I manage blocks"
              looks in Settings, so it is here rather than buried in a profile
              screen. */}
          <Surface elevation="subtle" padding={0} style={styles.section}>
            <Text variant="label" color="secondary" style={styles.sectionLabel}>
              {i18n.t('moderation.safety').toUpperCase()}
            </Text>
            <Stack spacing={0}>
              <ListItem
                left={<Feather name="slash" size={24} color={colors.textSecondary} />}
                title={i18n.t('moderation.blockedAccounts')}
                onPress={() => navigation.navigate('BlockedAccounts')}
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
              <View style={styles.divider} />
              {/* Ghost mode — the reversible half of "delete my account".
                  Promised in PrivacyPolicyScreen §3 and, until now, reachable
                  from nowhere. */}
              <ListItem
                left={<Feather name="eye-off" size={24} color={colors.textSecondary} />}
                title={i18n.t('settings.ghostMode')}
                subtitle={i18n.t('settings.ghostModeHint')}
                right={
                  ghostBusy ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Switch
                      value={ghosted}
                      onValueChange={handleGhostToggle}
                      trackColor={{ false: colors.border, true: colors.accent }}
                      accessibilityLabel={i18n.t('settings.ghostMode')}
                    />
                  )
                }
                showChevron={false}
                style={styles.listItemFlush}
              />
              {credit != null && credit > 0 ? (
                <>
                  <View style={styles.divider} />
                  {/* Granted when a business cancels late or no-shows. Not
                      spendable in-app yet — credits.CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED
                      is off until the capture path is verified in Stripe — so
                      the subtitle says how to use it rather than implying it
                      comes off the next booking automatically. */}
                  <ListItem
                    left={<Feather name="gift" size={24} color={colors.success} />}
                    title={i18n.t('settings.credit')}
                    subtitle={i18n.t('settings.creditHint')}
                    right={
                      <Text variant="bodyMedium" style={{ color: colors.success }}>
                        ${(credit / 100).toFixed(2)}
                      </Text>
                    }
                    showChevron={false}
                    style={styles.listItemFlush}
                  />
                </>
              ) : null}
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
                title={i18n.t('settings.deleteAccount')}
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

      {/* Delete-account confirmation (Guideline 5.1.1(v)). A modal rather than
          an Alert because it has to collect a password on some accounts and
          state the retention rule honestly on all of them — neither fits in an
          Alert body. */}
      <Modal
        visible={deleteVisible}
        onClose={() => setDeleteVisible(false)}
        title={i18n.t('settings.deleteAccountTitle')}
      >
        <Stack spacing="base">
          <Text variant="body" color="secondary">
            {i18n.t('settings.deleteAccountBody')}
          </Text>

          {needsPassword ? (
            <TextField
              label={i18n.t('settings.deleteAccountPasswordLabel')}
              value={deletePassword}
              onChangeText={(v) => {
                setDeletePassword(v);
                setDeleteError(null);
              }}
              secureTextEntry
              autoCapitalize="none"
              textContentType="password"
              placeholder={i18n.t('settings.deleteAccountPasswordHint')}
              error={deleteError}
            />
          ) : null}

          {deleteError && !needsPassword ? (
            <Text variant="small" style={{ color: colors.danger }}>
              {deleteError}
            </Text>
          ) : null}

          <Button
            variant="danger"
            label={
              deleteLoading
                ? i18n.t('settings.deleteAccountDeleting')
                : i18n.t('settings.deleteAccountConfirm')
            }
            onPress={confirmDeleteAccount}
            loading={deleteLoading}
            disabled={deleteLoading || (needsPassword && !deletePassword)}
          />
          <Button
            variant="secondary"
            label={i18n.t('settings.deleteAccountCancel')}
            onPress={() => setDeleteVisible(false)}
            disabled={deleteLoading}
          />
        </Stack>
      </Modal>
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
