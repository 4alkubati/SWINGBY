// RolePickerSheet — the one question a social sign-in never asked.
//
// A social sign-in started from the LOGIN screen carries no role, so the new
// account lands as 'client' (the DB trigger's default) and drops straight into
// the client dashboard. LoginScreen's own comment said "the app can offer the
// 'become a business' pick afterwards" — and then nothing ever did.
//
// The backend half has existed the whole time: `POST /auth/social/role` is a
// one-shot, deliberately narrow escalation (client -> business_owner only,
// within 24h of signup, only while the user owns no businesses). It was written
// for exactly this sheet and had no caller.
//
// WHY THIS MATTERS MORE ON iOS: a trade business often signs in on a shared
// iPad that is already logged into the owner's Apple ID. One tap and they are
// through — as a client, with no signup form to have told them otherwise, and
// no way back. Sign in with Apple is the fastest possible path to the wrong
// account type, which is why this shows for new social accounts and not for
// returning ones.
//
// Deliberately NOT dismissible by tapping outside. It has two safe answers and
// both are one tap; letting it be swiped away would leave the person in the
// state that caused the problem.

import React, { useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';

import Modal from './Modal';
import Text from './Text';
import Stack from './Stack';
import { api } from '../services/api';
import i18n from '../i18n';
import { colors, spacing, radius } from '../theme/tokens';

// A pressable ROW, not a <Button> — Button renders its `label` prop and drops
// children, so an icon-plus-two-lines choice cannot be expressed with it.
function Choice({ icon, title, body, onPress, busy, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.base,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceAlt,
          opacity: disabled && !busy ? 0.5 : pressed ? 0.9 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.pill,
          backgroundColor: colors.accentMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.accentText} />
        ) : (
          <Feather name={icon} size={18} color={colors.accentText} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">{title}</Text>
        <Text variant="caption" color="secondary">
          {body}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

export default function RolePickerSheet({ visible, onDone }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function choose(role) {
    if (busy) return;
    setBusy(role);
    setError(null);
    try {
      const res = await api.post('/auth/social/role', { role });
      onDone?.(res?.data?.role || role);
    } catch (err) {
      // 403 means the window closed or the account is already something else.
      // Not worth trapping anyone over — let them through as a client, which is
      // what they already are, and they can still convert later from Settings.
      if (err?.response?.status === 403) {
        onDone?.('client');
        return;
      }
      setError(i18n.t('rolePicker.failed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal visible={visible} onClose={() => {}} title={i18n.t('rolePicker.title')}>
      <Stack spacing="base">
        <Text variant="body" color="secondary">
          {i18n.t('rolePicker.body')}
        </Text>

        <Choice
          icon="home"
          title={i18n.t('rolePicker.clientTitle')}
          body={i18n.t('rolePicker.clientBody')}
          onPress={() => choose('client')}
          busy={busy === 'client'}
          disabled={!!busy}
        />
        <Choice
          icon="briefcase"
          title={i18n.t('rolePicker.businessTitle')}
          body={i18n.t('rolePicker.businessBody')}
          onPress={() => choose('business_owner')}
          busy={busy === 'business_owner'}
          disabled={!!busy}
        />

        {error ? (
          <Text variant="small" style={{ color: colors.danger }}>
            {error}
          </Text>
        ) : null}

        <Text variant="caption" color="secondary">
          {i18n.t('rolePicker.footnote')}
        </Text>
      </Stack>
    </Modal>
  );
}
