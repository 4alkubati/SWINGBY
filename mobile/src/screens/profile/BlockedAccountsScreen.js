// BlockedAccountsScreen — Settings → Safety → Blocked accounts.
//
// App Store Guideline 1.2(c). Blocking happens in context (a chat header, a
// business profile); UNBLOCKING has nowhere else to live, because once someone
// is blocked their threads and posts are gone from every surface that could
// have carried the undo. That is the whole reason this screen exists.
//
// Deliberately shows only OUTGOING blocks. Who blocked YOU is enforced (the
// backend's blocked_pair_ids is symmetric) but never disclosed — telling
// someone they have been blocked is how a block turns into an escalation.

import React, { useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import Text from '../../components/Text';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { show as showToast } from '../../services/toast';
import { listBlockedUsers, unblockUser } from '../../services/moderation';
import i18n from '../../i18n';
import { colors, spacing, radius } from '../../theme/tokens';

function fullName(u) {
  return [u?.first_name, u?.last_name].filter(Boolean).join(' ') || 'SwingBy user';
}

export default function BlockedAccountsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setItems(await listBlockedUsers());
    } catch {
      // A failed load shows the empty state rather than an error wall: the
      // list is small, the screen is reachable again in one tap, and an error
      // page here would be more alarming than the thing it is reporting.
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on focus — the user arrives here right after blocking someone from
  // a chat, and a stale list would not show them.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function confirmUnblock(row) {
    const name = fullName(row.blocked);
    Alert.alert(
      i18n.t('moderation.unblockConfirmTitle', { name }),
      i18n.t('moderation.unblockConfirmBody'),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('moderation.unblock'),
          onPress: async () => {
            setBusyId(row.blocked_id);
            try {
              await unblockUser(row.blocked_id);
              setItems((prev) => prev.filter((r) => r.blocked_id !== row.blocked_id));
            } catch {
              showToast({ type: 'error', text1: i18n.t('common.error') });
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Button
          variant="ghost"
          label=""
          icon={<Feather name="arrow-left" size={20} color={colors.textPrimary} />}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        />
        <Text variant="h1">{i18n.t('moderation.blockedAccountsTitle')}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(row) => row.id || row.blocked_id}
          contentContainerStyle={
            items.length
              ? { padding: spacing.base, gap: spacing.sm }
              : styles.emptyWrap
          }
          ListEmptyComponent={
            <EmptyState
              icon="slash"
              title={i18n.t('moderation.blockedEmptyTitle')}
              body={i18n.t('moderation.blockedEmptyBody')}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar
                uri={item.blocked?.avatar_url}
                name={fullName(item.blocked)}
                size={40}
              />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" numberOfLines={1}>
                  {fullName(item.blocked)}
                </Text>
                {item.created_at ? (
                  <Text variant="caption" color="secondary">
                    {i18n.t('moderation.blockedOn', {
                      date: new Date(item.created_at).toLocaleDateString(),
                    })}
                  </Text>
                ) : null}
              </View>
              <Button
                variant="secondary"
                label={i18n.t('moderation.unblock')}
                onPress={() => confirmUnblock(item)}
                loading={busyId === item.blocked_id}
                disabled={busyId === item.blocked_id}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { paddingHorizontal: 0, minWidth: 32 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
