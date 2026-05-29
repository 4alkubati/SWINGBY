// T63 — SettingsScreen
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Switch, Alert, Share, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { show as showToast } from '../services/toast';
import LanguageSelector from '../components/LanguageSelector';
import i18n from '../i18n';

const APP_VERSION =
  Constants.expoConfig?.version ??
  Constants.manifest?.version ??
  Constants.manifest2?.extra?.expoClient?.version ??
  '1.0.0';

function SettingsRow({ icon, label, onPress, rightEl, destructive, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      activeOpacity={disabled ? 1 : 0.7}
      disabled={disabled}
    >
      {icon && (
        <View style={styles.rowIcon}>
          <Feather name={icon} size={16} color={destructive ? '#ef4444' : '#9ca3af'} />
        </View>
      )}
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        {rightEl ?? <Feather name="chevron-right" size={16} color="#3a424c" />}
      </View>
    </TouchableOpacity>
  );
}

function SectionCard({ title, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  const [notifEnabled, setNotifEnabled] = useState(false);
  const [langVisible, setLangVisible] = useState(false);
  const [currentLocale, setCurrentLocale] = useState(i18n.locale);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifEnabled(status === 'granted');
    });
  }, []);

  async function toggleNotifications(val) {
    if (val) {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotifEnabled(status === 'granted');
    } else {
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ACCOUNT */}
        <SectionCard title="ACCOUNT">
          <SettingsRow
            icon="user"
            label="Edit profile"
            onPress={() => navigation.navigate('ProfileEdit')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="globe"
            label="Language"
            onPress={() => setLangVisible(true)}
            rightEl={
              <View style={styles.localeChip}>
                <Text style={styles.localeChipText}>
                  {currentLocale === 'fr-CA' ? 'FR' : 'EN'}
                </Text>
              </View>
            }
          />
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Feather name="bell" size={16} color="#9ca3af" />
            </View>
            <Text style={styles.rowLabel}>Notifications</Text>
            <View style={styles.rowRight}>
              <Switch
                value={notifEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: '#2a2e33', true: 'rgba(255,92,0,0.4)' }}
                thumbColor={notifEnabled ? '#FF5C00' : '#6b7280'}
              />
            </View>
          </View>
        </SectionCard>

        {/* PRIVACY & LEGAL */}
        <SectionCard title="PRIVACY & LEGAL">
          <SettingsRow
            icon="shield"
            label="Privacy Policy"
            onPress={() => navigation.navigate('PrivacyPolicy')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="file-text"
            label="Terms of Service"
            onPress={() => navigation.navigate('TermsOfService')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="download"
            label="Export my data"
            onPress={handleExportData}
            disabled={exportLoading}
            rightEl={
              exportLoading
                ? <ActivityIndicator size="small" color="#FF5C00" />
                : <Feather name="chevron-right" size={16} color="#3a424c" />
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="trash-2"
            label={deleteLoading ? 'Deleting…' : 'Delete my account'}
            onPress={handleDeleteAccount}
            destructive
            disabled={deleteLoading}
            rightEl={
              deleteLoading
                ? <ActivityIndicator size="small" color="#ef4444" />
                : null
            }
          />
        </SectionCard>

        {/* SUPPORT */}
        <SectionCard title="SUPPORT">
          <SettingsRow
            icon="help-circle"
            label="Help & FAQ"
            onPress={() => navigation.navigate('HelpFAQ')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="mail"
            label="Contact us"
            onPress={handleContactUs}
          />
        </SectionCard>

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          activeOpacity={0.85}
        >
          <Feather name="log-out" size={16} color="#ef4444" style={{ marginRight: 8 }} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Version footer */}
        <Text style={styles.versionText}>SwingBy v{APP_VERSION}</Text>
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
    backgroundColor: '#07080a',
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1d1f',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 16,
  },
  card: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 18,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 56,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowIcon: {
    width: 28,
    alignItems: 'flex-start',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: '#f0ede8',
    fontWeight: '500',
  },
  rowLabelDestructive: {
    color: '#ef4444',
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  divider: {
    height: 1,
    backgroundColor: '#1a1d1f',
    marginLeft: 16,
  },
  localeChip: {
    backgroundColor: 'rgba(255,92,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.25)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  localeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF8C42',
    letterSpacing: 0.5,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 14,
    paddingVertical: 16,
    minHeight: 54,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#3a424c',
    marginTop: 4,
  },
});
