// AutoBiddingScreen — rules-based automatic quoting.
//
// Spec: design/handoff-jet-pulse/PROOF-REQUEST-WEB-AUTOBID.md §4.
// Rulings (Kira, 2026-07-24, design/DESIGN-SYSTEM.md "Product rules"):
//
//   * PAID FEATURE, SUBSCRIBERS ONLY. Non-subscribers get the whole screen in a
//     locked upgrade state — they can see exactly what it does and how to get
//     it, but the switch cannot be enabled. The gate is the real subscription
//     status from the server ('active' / 'trialing' are entitled), and the API
//     refuses the write regardless of what this screen allows.
//   * The client's budget is HIDDEN from businesses. Nothing on this screen
//     reads or shows it; the bid is this business's own rate applied to the
//     job's scope, clamped up to their floor.
//   * Turning the switch on the first time opens the dry run instead of going
//     live. That gate is re-checked in the API and by a DB CHECK constraint.
//
// Route params: none.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Switch,
  PanResponder,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

import Text from '../../components/Text';
import AutoBidPreviewSheet from '../../components/AutoBidPreviewSheet';
import { api } from '../../services/api';
import * as haptics from '../../services/haptics';
import * as toast from '../../services/toast';
import i18n from '../../i18n';
import { colors, radius } from '../../theme/tokens';

// Local constants — theme/tokens.js belongs to another lane this cycle.
const KNOB = 16;
const TRACK_HEIGHT = 4;
const RADIUS_MIN = 1;
const RADIUS_MAX = 50;

const SERVICES = ['Deep clean', 'Move-out', 'Standard', 'Office', 'Post-reno'];

function dollars(cents) {
  return String(Math.round(Number(cents || 0) / 100));
}

function toCents(text) {
  const n = parseFloat(String(text).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// ─── Gradient on/off hero ────────────────────────────────────────────────────
function AutoBidHero({ enabled, locked, onToggle }) {
  return (
    <View style={styles.hero}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="autoBidBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#2A2247" />
            <Stop offset="0.6" stopColor="#1A1533" />
            <Stop offset="1" stopColor="#141127" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#autoBidBg)" rx="20" />
      </Svg>

      <View style={styles.heroInner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroEyebrow}>AUTO-BID</Text>
          <Text style={styles.heroState}>
            {locked ? 'Locked' : enabled ? 'On' : 'Off'}
          </Text>
          <Text style={styles.heroSub} numberOfLines={2}>
            {locked
              ? 'Part of a SwingBy subscription'
              : 'Quotes send themselves in ~30 s'}
          </Text>
        </View>

        {locked ? (
          <View style={styles.lockTile}>
            <Feather name="lock" size={18} color={colors.accentSoft} />
          </View>
        ) : (
          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={enabled ? colors.accent : colors.textSecondary}
            accessibilityLabel="Auto-bidding"
          />
        )}
      </View>
    </View>
  );
}

// ─── Radius slider ───────────────────────────────────────────────────────────
// No slider dependency exists and none may be added, so this is a track plus a
// PanResponder. The value is announced and also adjustable from the a11y
// increment/decrement actions, which a bare pan target would not be.
function RadiusSlider({ value, onChange, disabled }) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);

  const clamp = (v) => Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(v)));

  const setFromX = useCallback(
    (x) => {
      const w = widthRef.current;
      if (!w) return;
      const ratio = Math.min(1, Math.max(0, x / w));
      onChange(clamp(RADIUS_MIN + ratio * (RADIUS_MAX - RADIUS_MIN)));
    },
    [onChange],
  );

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
    }),
  ).current;

  const ratio = (value - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN);

  return (
    <View style={styles.sliderWrap} pointerEvents={disabled ? 'none' : 'auto'}>
      <Text style={styles.sliderValue}>{value} km</Text>
      <View
        style={styles.sliderTouch}
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width;
          setWidth(e.nativeEvent.layout.width);
        }}
        accessibilityRole="adjustable"
        accessibilityLabel="Bid within"
        accessibilityValue={{ min: RADIUS_MIN, max: RADIUS_MAX, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onChange(clamp(value + 1));
          if (e.nativeEvent.actionName === 'decrement') onChange(clamp(value - 1));
        }}
        {...responder.panHandlers}
      >
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${ratio * 100}%` }]} />
        </View>
        <View
          style={[
            styles.sliderKnob,
            { left: Math.max(0, ratio * width - KNOB / 2) },
          ]}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

// ─── Limits row ──────────────────────────────────────────────────────────────
function LimitRow({ label, caption, children, isLast }) {
  return (
    <View style={[styles.limitRow, !isLast && styles.limitRowDivider]}>
      <View style={styles.limitLabelCol}>
        <Text style={styles.limitLabel}>{label}</Text>
        {!!caption && <Text style={styles.limitCaption}>{caption}</Text>}
      </View>
      <View style={styles.limitControlCol}>{children}</View>
    </View>
  );
}

// A stepper rather than a free-text field: these are money and count limits,
// and a keyboard that can produce "" or "12.999" is a worse control than two
// 44px buttons around a tabular number.
function Stepper({ value, onChange, step = 1, min = 0, max = 9999, format, disabled }) {
  const bump = (delta) => {
    haptics.buttonTap?.();
    onChange(Math.min(max, Math.max(min, value + delta)));
  };
  return (
    <View style={styles.stepper} pointerEvents={disabled ? 'none' : 'auto'}>
      <Pressable
        onPress={() => bump(-step)}
        style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.9 }]}
        accessibilityRole="button"
        accessibilityLabel="Decrease"
      >
        <Feather name="minus" size={14} color={colors.textSecondary} />
      </Pressable>
      <Text style={styles.stepperValue}>{format ? format(value) : String(value)}</Text>
      <Pressable
        onPress={() => bump(step)}
        style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.9 }]}
        accessibilityRole="button"
        accessibilityLabel="Increase"
      >
        <Feather name="plus" size={14} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function AutoBiddingScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [entitled, setEntitled] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  const [dryRunPassed, setDryRunPassed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const [rules, setRules] = useState({
    enabled: false,
    categories: [],
    radius_km: 12,
    hourly_rate_cents: 5500,
    floor_cents: 12000,
    max_bids_per_day: 8,
    require_free_crew: true,
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [dryRun, setDryRun] = useState({ loading: false, error: null, result: null });
  const [activating, setActivating] = useState(false);

  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/businesses/me/auto-bid');
      if (!mounted.current) return;
      setEntitled(!!res.entitled);
      setSubStatus(res.subscription_status || null);
      setDryRunPassed(!!res.dry_run_passed);
      const r = res.rules || {};
      setRules({
        enabled: !!r.enabled,
        categories: Array.isArray(r.categories) ? r.categories : [],
        radius_km: r.radius_km ?? 12,
        hourly_rate_cents: r.hourly_rate_cents ?? 5500,
        floor_cents: r.floor_cents ?? 12000,
        max_bids_per_day: r.max_bids_per_day ?? 8,
        require_free_crew: r.require_free_crew !== false,
      });
      setStatus('ready');
    } catch {
      if (!mounted.current) return;
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const patch = (changes) => setRules((prev) => ({ ...prev, ...changes }));

  function toggleService(name) {
    if (!entitled) return;
    haptics.buttonTap?.();
    setRules((prev) => ({
      ...prev,
      categories: prev.categories.includes(name)
        ? prev.categories.filter((c) => c !== name)
        : [...prev.categories, name],
    }));
  }

  function rulesUsable() {
    return (
      rules.categories.length > 0 &&
      rules.hourly_rate_cents > 0 &&
      rules.floor_cents > 0
    );
  }

  function handleHeroToggle(next) {
    if (!entitled) return;

    if (!next) {
      patch({ enabled: false });
      return;
    }

    if (!rulesUsable()) {
      Alert.alert(
        'Finish your rules first',
        'Pick at least one service and set your rate and your never-bid-below floor.',
      );
      return;
    }

    if (!dryRunPassed) {
      // First time on: the dry run IS the switch.
      openDryRun();
      return;
    }
    patch({ enabled: true });
  }

  async function openDryRun() {
    setSheetOpen(true);
    setDryRun({ loading: true, error: null, result: null });
    try {
      const res = await api.post('/businesses/me/auto-bid/dry-run', payload());
      if (!mounted.current) return;
      setDryRun({ loading: false, error: null, result: res });
    } catch (err) {
      if (!mounted.current) return;
      setDryRun({
        loading: false,
        error:
          err?.response?.data?.detail || err?.message || 'Try again in a moment.',
        result: null,
      });
    }
  }

  function payload() {
    return {
      categories: rules.categories,
      radius_km: rules.radius_km,
      hourly_rate_cents: rules.hourly_rate_cents,
      floor_cents: rules.floor_cents,
      max_bids_per_day: rules.max_bids_per_day,
      require_free_crew: rules.require_free_crew,
    };
  }

  async function handleActivate() {
    setActivating(true);
    try {
      await api.post('/businesses/me/auto-bid/activate', payload());
      haptics.successTap?.();
      setSheetOpen(false);
      await load();
      toast.show({
        type: 'success',
        text1: 'Auto-bidding is on',
        text2: 'You can withdraw any auto-quote within 5 minutes.',
      });
    } catch (err) {
      Alert.alert(
        "Didn't turn on",
        err?.response?.data?.detail || err?.message || 'Try again in a moment.',
      );
    } finally {
      if (mounted.current) setActivating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/businesses/me/auto-bid', { ...payload(), enabled: rules.enabled });
      haptics.successTap?.();
      toast.show({ type: 'success', text1: 'Rules saved' });
      await load();
    } catch (err) {
      Alert.alert(
        "Couldn't save",
        err?.response?.data?.detail || err?.message || 'Try again in a moment.',
      );
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  async function handleSubscribe() {
    setSubscribing(true);
    try {
      const res = await api.post('/businesses/me/subscribe', {});
      if (res?.checkout_url) await Linking.openURL(res.checkout_url);
      await load();
    } catch (err) {
      Alert.alert(
        "Couldn't start the subscription",
        err?.response?.data?.detail || err?.message || 'Try again in a moment.',
      );
    } finally {
      if (mounted.current) setSubscribing(false);
    }
  }

  // ── States ─────────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.centeredBody}>{i18n.t('common.loading')}</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <View style={styles.stateCircle}>
          <Feather name="wifi-off" size={26} color={colors.textSecondary} />
        </View>
        <Text style={styles.centeredTitle}>Couldn't load your rules</Text>
        <Text style={styles.centeredBody}>
          Nothing changed. Check your connection and try again.
        </Text>
        <Pressable
          onPress={() => {
            setStatus('loading');
            load();
          }}
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryBtnText}>{i18n.t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const locked = !entitled;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('common.back')}
          style={styles.headerBtn}
        >
          <Feather name="arrow-left" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Auto-bidding</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <AutoBidHero enabled={rules.enabled} locked={locked} onToggle={handleHeroToggle} />

        {locked && (
          <View style={styles.upgradeCard}>
            <Text style={styles.upgradeTitle}>Quote while you work</Text>
            <Text style={styles.upgradeBody}>
              Set your rate once and SwingBy sends the quote for you, usually inside
              30 seconds of a job being posted. Your rules decide the price — never
              the client's budget, which you never see.
            </Text>

            {[
              ['zap', 'Quotes go out in ~30 s, day or night'],
              ['shield', 'A floor you set is never breached'],
              ['rotate-ccw', 'Withdraw any auto-quote within 5 minutes'],
            ].map(([icon, line]) => (
              <View key={line} style={styles.upgradeRow}>
                <Feather name={icon} size={16} color={colors.accentText} />
                <Text style={styles.upgradeRowText}>{line}</Text>
              </View>
            ))}

            {subStatus === 'past_due' && (
              <View style={styles.warnChip}>
                <Feather name="alert-triangle" size={13} color={colors.warning} />
                <Text style={styles.warnChipText}>
                  Your subscription is past due — update billing to switch this back on.
                </Text>
              </View>
            )}

            <Pressable
              onPress={handleSubscribe}
              disabled={subscribing}
              style={({ pressed }) => [
                styles.cta,
                { marginTop: 4 },
                subscribing && { opacity: 0.4 },
                pressed && !subscribing && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Subscribe to unlock auto-bidding"
            >
              {subscribing ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <Text style={styles.ctaLabel}>
                  {subStatus === 'past_due' ? 'Update billing' : 'Subscribe to unlock'}
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {/* The rules stay VISIBLE when locked — the point of the upgrade state is
            to show what you'd be getting — but nothing in them is editable. */}
        <View style={[styles.section, locked && styles.lockedBlock]} pointerEvents={locked ? 'none' : 'auto'}>
          <Text style={styles.sectionLabel}>BID ON</Text>
          <View style={styles.chipWrap}>
            {SERVICES.map((name) => {
              const selected = rules.categories.includes(name);
              return (
                <Pressable
                  key={name}
                  onPress={() => toggleService(name)}
                  style={({ pressed }) => [
                    styles.chip,
                    selected ? styles.chipSelected : styles.chipIdle,
                    pressed && { opacity: 0.9 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={name}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, locked && styles.lockedBlock]} pointerEvents={locked ? 'none' : 'auto'}>
          <Text style={styles.sectionLabel}>LIMITS</Text>
          <View style={styles.limitsCard}>
            <LimitRow label="Within">
              <RadiusSlider
                value={rules.radius_km}
                onChange={(v) => patch({ radius_km: v })}
                disabled={locked}
              />
            </LimitRow>

            <LimitRow label="My rate" caption="Applied to the job's scope">
              <Stepper
                value={rules.hourly_rate_cents}
                step={500}
                min={0}
                max={100000}
                onChange={(v) => patch({ hourly_rate_cents: v })}
                format={(v) => `$${dollars(v)} / hr`}
                disabled={locked}
              />
            </LimitRow>

            <LimitRow label="Never bid below" caption="A hard floor — never breached">
              <Stepper
                value={rules.floor_cents}
                step={1000}
                min={0}
                max={1000000}
                onChange={(v) => patch({ floor_cents: v })}
                format={(v) => `$${dollars(v)}`}
                disabled={locked}
              />
            </LimitRow>

            <LimitRow label="Max bids per day">
              <Stepper
                value={rules.max_bids_per_day}
                step={1}
                min={1}
                max={50}
                onChange={(v) => patch({ max_bids_per_day: v })}
                disabled={locked}
              />
            </LimitRow>

            <LimitRow label="Only when a crew is free" caption="Checks the team calendar" isLast>
              <Switch
                value={rules.require_free_crew}
                onValueChange={(v) => patch({ require_free_crew: v })}
                trackColor={{ false: colors.border, true: colors.accentMuted }}
                thumbColor={rules.require_free_crew ? colors.accent : colors.textSecondary}
                disabled={locked}
                accessibilityLabel="Only bid when a crew is free"
              />
            </LimitRow>
          </View>

          <Text style={styles.limitsFootnote}>
            Checked when a quote would actually go out, not when you save — your
            calendar and today's count both move after this screen closes.
          </Text>
        </View>

        {!locked && dryRunPassed && (
          <Pressable
            onPress={openDryRun}
            style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
          >
            <Feather name="play-circle" size={16} color={colors.accentText} />
            <Text style={styles.ghostBtnText}>Run the preview again</Text>
          </Pressable>
        )}
      </ScrollView>

      {!locked && (
        <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveBtn,
              saving && { opacity: 0.4 },
              pressed && !saving && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Save rules"
            accessibilityState={{ busy: saving }}
          >
            {saving ? (
              <ActivityIndicator color={colors.textSecondary} />
            ) : (
              <Text style={styles.saveBtnText}>Save rules</Text>
            )}
          </Pressable>
        </View>
      )}

      <AutoBidPreviewSheet
        visible={sheetOpen}
        loading={dryRun.loading}
        error={dryRun.error}
        result={dryRun.result}
        activating={activating}
        onRetry={openDryRun}
        onClose={() => setSheetOpen(false)}
        onActivate={handleActivate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, gap: 8 },
  centeredTitle: { fontSize: 15.5, fontWeight: '600', color: colors.textPrimary, marginTop: 4 },
  centeredBody: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stateCircle: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    marginTop: 12,
    height: 46,
    paddingHorizontal: 24,
    borderRadius: radius.button,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerBtn: { width: 40, minHeight: 44, justifyContent: 'center' },
  headerTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 17,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 12 },

  hero: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    overflow: 'hidden',
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 17,
  },
  heroEyebrow: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: colors.accentSoft,
  },
  heroState: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 19,
    letterSpacing: -0.5,
    color: colors.textPrimary,
    marginTop: 2,
  },
  heroSub: { fontSize: 12.5, lineHeight: 18, color: colors.accentSoft, marginTop: 2 },
  lockTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  upgradeCard: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  upgradeTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 17,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  upgradeBody: { fontSize: 13.5, lineHeight: 21, color: colors.textSecondary },
  upgradeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  upgradeRowText: { flex: 1, fontSize: 13, lineHeight: 20, color: colors.textPrimary },
  warnChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(246,178,59,0.14)',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  warnChipText: { flex: 1, fontSize: 11.5, lineHeight: 18, color: colors.warning },

  section: { marginTop: 32 },
  // Locked = one opacity on the block, never a per-element recolor.
  lockedBlock: { opacity: 0.4 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.textSecondary,
    marginBottom: 12,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipIdle: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.accentMuted },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextSelected: { color: colors.textPrimary },

  limitsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
  },
  limitRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  limitLabelCol: { flex: 1 },
  limitControlCol: { flexShrink: 0, alignItems: 'flex-end', minWidth: 128 },
  limitLabel: { fontSize: 13.5, color: colors.textSecondary },
  limitCaption: { fontSize: 11.5, lineHeight: 17, color: colors.textTertiary, marginTop: 2 },
  limitsFootnote: {
    marginTop: 12,
    fontSize: 11.5,
    lineHeight: 18,
    color: colors.textTertiary,
  },

  sliderWrap: { width: 128, alignItems: 'flex-end', gap: 8 },
  sliderValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  sliderTouch: { width: '100%', height: 28, justifyContent: 'center' },
  sliderTrack: {
    height: TRACK_HEIGHT,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  sliderFill: { height: TRACK_HEIGHT, borderRadius: 999, backgroundColor: colors.accent },
  sliderKnob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepperBtn: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 74,
    textAlign: 'center',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    color: colors.success,
    fontVariant: ['tabular-nums'],
  },

  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    height: 46,
  },
  ghostBtnText: { fontSize: 14, fontWeight: '600', color: colors.accentText },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // Secondary styling on purpose: the ONE purple CTA on this screen is either
  // "Subscribe to unlock" (locked) or "Turn auto-bidding on" in the sheet.
  saveBtn: {
    height: 52,
    borderRadius: radius.button,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 15.5, fontWeight: '600', color: colors.textSecondary },

  cta: {
    height: 52,
    borderRadius: radius.button,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { fontSize: 15.5, fontWeight: '600', color: colors.textPrimary },
});
