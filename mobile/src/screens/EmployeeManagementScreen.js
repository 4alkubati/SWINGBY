// T51 — EmployeeManagementScreen
// Business owner: view team list, search, toggle active, edit via bottom sheet
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Switch,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { SkeletonList } from '../components/Skeleton';
import { colors } from '../theme/tokens';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toInitials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_GRADIENTS = [
  { bg: colors.accentMuted, color: colors.accent },
  { bg: colors.success + '1A', color: colors.success },
  { bg: colors.accentMuted, color: colors.accent },
  { bg: colors.warning + '1A', color: colors.warning },
];

function avatarStyle(index) {
  return AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
}

// ─── EmployeeRow ──────────────────────────────────────────────────────────────
function EmployeeRow({ employee, index, onPress, onToggle, toggling }) {
  const fullName = employee.user
    ? `${employee.user.first_name} ${employee.user.last_name}`
    : employee.name || 'Employee';
  const { bg, color } = avatarStyle(index);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onPress(employee)}
      activeOpacity={0.75}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: bg }]}>
        <Text style={[styles.avatarText, { color }]}>{toInitials(fullName)}</Text>
      </View>

      {/* Name + role */}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>{fullName}</Text>
        <Text style={styles.rowRole} numberOfLines={1}>
          {employee.role_title || 'Team Member'}
        </Text>
      </View>

      {/* Active toggle */}
      {toggling === employee.id ? (
        <ActivityIndicator size="small" color={colors.accent} style={styles.rowToggleArea} />
      ) : (
        <Switch
          value={employee.is_active !== false}
          onValueChange={(val) => onToggle(employee, val)}
          thumbColor={employee.is_active !== false ? colors.accent : colors.textSecondary}
          trackColor={{ false: colors.border, true: colors.accent + '4D' }} // 30% opacity
          style={styles.rowSwitch}
        />
      )}

      {/* Chevron */}
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// ─── EmployeeEditModal (bottom sheet) ────────────────────────────────────────
function EmployeeEditModal({ employee, visible, onClose, onSaved }) {
  const [roleTitle, setRoleTitle] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (employee) {
      setRoleTitle(employee.role_title || '');
      setIsActive(employee.is_active !== false);
    }
  }, [employee]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  async function handleSave() {
    if (!employee) return;
    setSaving(true);
    try {
      // Toggle active state if changed
      if (isActive && employee.is_active === false) {
        await api.patch(`/employees/${employee.id}/reactivate`);
      } else if (!isActive && employee.is_active !== false) {
        await api.patch(`/employees/${employee.id}/deactivate`);
      }
      onSaved({ ...employee, role_title: roleTitle, is_active: isActive });
      onClose();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  const fullName = employee?.user
    ? `${employee.user.first_name} ${employee.user.last_name}`
    : employee?.name || 'Employee';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} activeOpacity={1} />
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Handle */}
          <View style={styles.sheetHandle} />

          <Text style={styles.sheetTitle}>Edit Employee</Text>

          {/* Name read-only */}
          <View style={styles.sheetField}>
            <Text style={styles.sheetLabel}>Name</Text>
            <View style={styles.sheetReadOnly}>
              <Text style={styles.sheetReadOnlyText}>{fullName}</Text>
            </View>
          </View>

          {/* Role title editable */}
          <View style={styles.sheetField}>
            <Text style={styles.sheetLabel}>Role Title</Text>
            <TextInput
              style={styles.sheetInput}
              value={roleTitle}
              onChangeText={setRoleTitle}
              placeholder='e.g. "Senior Cleaner"'
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Active toggle */}
          <View style={styles.sheetToggleRow}>
            <View>
              <Text style={styles.sheetToggleLabel}>Active</Text>
              <Text style={styles.sheetToggleSub}>Visible to clients when active</Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              thumbColor={isActive ? colors.accent : colors.textSecondary}
              trackColor={{ false: colors.border, true: colors.accent + '4D' }} // 30% opacity
            />
          </View>

          {/* Save CTA */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={colors.textPrimary} />
              : <Text style={styles.saveBtnText}>Save</Text>
            }
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── InviteModal ──────────────────────────────────────────────────────────────
function InviteModal({ visible, bizId, onClose }) {
  const inviteUrl = `swingby://invite/${bizId || 'demo'}`;

  function handleCopy() {
    Clipboard.setStringAsync(inviteUrl);
    Alert.alert('Copied!', 'Invite link copied to clipboard.');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.inviteSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Invite Teammate</Text>
          <Text style={styles.inviteSubtitle}>
            Share this link with your teammate. They'll join your team after signing up.
          </Text>
          <View style={styles.inviteLinkBox}>
            <Text style={styles.inviteLinkText} numberOfLines={1}>{inviteUrl}</Text>
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleCopy} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Copy Invite Link</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyTeam({ onInvite }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>👥</Text>
      <Text style={styles.emptyTitle}>No employees yet</Text>
      <Text style={styles.emptySub}>Invite teammates to help with bookings.</Text>
      <TouchableOpacity style={styles.saveBtn} onPress={onInvite} activeOpacity={0.85}>
        <Text style={styles.saveBtnText}>Invite first teammate</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function EmployeeManagementScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const bizId = route?.params?.businessId;

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [toggling, setToggling] = useState(null); // employee id being toggled
  const [editTarget, setEditTarget] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/employees/');
      setEmployees(Array.isArray(data) ? data : (data?.items || data?.results || []));
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = employees.filter((e) => {
    if (!query.trim()) return true;
    const name = e.user
      ? `${e.user.first_name} ${e.user.last_name}`
      : e.name || '';
    return name.toLowerCase().includes(query.toLowerCase());
  });

  function openEdit(employee) {
    setEditTarget(employee);
    setShowEdit(true);
  }

  async function handleQuickToggle(employee, val) {
    setToggling(employee.id);
    try {
      if (val) {
        await api.patch(`/employees/${employee.id}/reactivate`);
      } else {
        await api.patch(`/employees/${employee.id}/deactivate`);
      }
      setEmployees((prev) =>
        prev.map((e) => e.id === employee.id ? { ...e, is_active: val } : e)
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not update status.');
    } finally {
      setToggling(null);
    }
  }

  function handleSaved(updated) {
    setEmployees((prev) =>
      prev.map((e) => e.id === updated.id ? updated : e)
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team</Text>
        <TouchableOpacity
          style={styles.inviteBtn}
          onPress={() => setShowInvite(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.inviteBtnText}>+ Invite</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name…"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.skeletonWrap}>
          <SkeletonList count={5} />
        </View>
      ) : filtered.length === 0 && employees.length === 0 ? (
        <EmptyTeam onInvite={() => setShowInvite(true)} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No results for "{query}"</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <EmployeeRow
              employee={item}
              index={index}
              onPress={openEdit}
              onToggle={handleQuickToggle}
              toggling={toggling}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Edit bottom sheet */}
      <EmployeeEditModal
        employee={editTarget}
        visible={showEdit}
        onClose={() => setShowEdit(false)}
        onSaved={handleSaved}
      />

      {/* Invite modal */}
      <InviteModal
        visible={showInvite}
        bizId={bizId}
        onClose={() => setShowInvite(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 10,
  },
  backBtn: { fontSize: 24, color: colors.textSecondary, width: 40 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  inviteBtn: {
    backgroundColor: colors.accent + '1F', // ~12% opacity
    borderWidth: 1,
    borderColor: colors.accent + '4D', // ~30% opacity
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtnText: { fontSize: 13, fontWeight: '700', color: colors.accent },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: 22,
    marginBottom: 10,
    gap: 10,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
  searchClear: { fontSize: 13, color: colors.textSecondary },

  // List
  skeletonWrap: { paddingHorizontal: 22, paddingTop: 6 },
  listContent: { paddingHorizontal: 22, paddingBottom: 30 },
  separator: { height: 8 },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    minHeight: 72,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  rowInfo: { flex: 1, gap: 3 },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3 },
  rowRole: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  rowToggleArea: { marginRight: 8 },
  rowSwitch: { marginRight: 2 },
  chevron: { fontSize: 22, color: colors.textSecondary, marginLeft: 4 },

  // Empty
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  emptySub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Modal overlay
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },

  // Bottom sheet
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3 },
  sheetField: { gap: 8 },
  sheetLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sheetReadOnly: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sheetReadOnlyText: { fontSize: 14, color: colors.textSecondary },
  sheetInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },
  sheetToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  sheetToggleLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  sheetToggleSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // Invite sheet (same base as sheet but standalone)
  inviteSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: 24,
    paddingBottom: 40,
    gap: 14,
  },
  inviteSubtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  inviteLinkBox: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.accent + '40', // ~25% opacity
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inviteLinkText: { fontSize: 13, color: colors.accent, fontWeight: '500' },

  // Save button (shared)
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    minHeight: 52,
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
});
