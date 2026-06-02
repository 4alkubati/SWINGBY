import {
  View, ScrollView, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing,
} from 'react-native-reanimated';

import Text from '../components/Text';
import TextField from '../components/TextField';
import Button from '../components/Button';
import Stack from '../components/Stack';
import Surface from '../components/Surface';
import Chip from '../components/Chip';
import Inline from '../components/Inline';

import { api } from '../services/api';
import { colors, spacing, radius } from '../theme/tokens';

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Cleaning', 'Plumbing', 'Electrical',
  'Landscaping', 'Painting', 'Carpentry', 'Moving',
];

const STEPS = ['Category', 'Details', 'Budget', 'Confirm'];
const TOTAL_STEPS = STEPS.length;

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step }) {
  const pct = ((step + 1) / TOTAL_STEPS) * 100;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
    </View>
  );
}

// ─── Step labels ─────────────────────────────────────────────────────────────
function StepLabels({ step }) {
  return (
    <Inline justify="space-between" style={styles.stepLabels}>
      {STEPS.map((label, i) => (
        <Text
          key={label}
          variant="label"
          color={i <= step ? 'accent' : 'secondary'}
          style={i <= step ? styles.stepLabelActive : undefined}
        >
          {label}
        </Text>
      ))}
    </Inline>
  );
}

// ─── Animated step panel ──────────────────────────────────────────────────────
function StepPanel({ children, direction }) {
  // direction: 1 = entering from right, -1 = entering from left
  const translateX = useSharedValue(direction * 300);
  const opacity = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  // Animate in on mount
  useState(() => {
    translateX.value = withSpring(0, { stiffness: 260, damping: 26 });
    opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
  });

  return (
    <Animated.View style={[{ flex: 1 }, style]}>
      {children}
    </Animated.View>
  );
}

// ─── Step 0: Category ────────────────────────────────────────────────────────
function StepCategory({ category, setCategory }) {
  return (
    <StepPanel direction={1}>
      <Stack spacing="lg">
        <Stack spacing="sm">
          <Text variant="display3">What type of job?</Text>
          <Text variant="body" color="secondary">
            Pick the category that best describes your task.
          </Text>
        </Stack>
        <Inline wrap spacing="sm">
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              selected={category === cat}
              onPress={() => setCategory(cat === category ? '' : cat)}
            />
          ))}
        </Inline>
      </Stack>
    </StepPanel>
  );
}

// ─── Step 1: Details ─────────────────────────────────────────────────────────
function StepDetails({ description, setDescription, address, setAddress, descError }) {
  return (
    <StepPanel direction={1}>
      <Stack spacing="lg">
        <Stack spacing="sm">
          <Text variant="display3">Describe the job</Text>
          <Text variant="body" color="secondary">
            The more detail you add, the better quotes you'll receive.
          </Text>
        </Stack>
        <Stack spacing="base">
          <TextField
            label="What do you need? *"
            value={description}
            onChangeText={setDescription}
            multiline
            error={descError}
            numberOfLines={4}
            textAlignVertical="top"
            placeholder="e.g. Deep clean of 2-bedroom apartment, fix leaking pipe, move furniture…"
          />
          <TextField
            label="Address (where's the job?)"
            value={address}
            onChangeText={setAddress}
            placeholder="123 Main St SW, Calgary"
            autoCapitalize="words"
          />
        </Stack>
      </Stack>
    </StepPanel>
  );
}

// ─── Step 2: Budget ──────────────────────────────────────────────────────────
function StepBudget({ budget, setBudget, date, setDate, time, setTime }) {
  return (
    <StepPanel direction={1}>
      <Stack spacing="lg">
        <Stack spacing="sm">
          <Text variant="display3">Budget &amp; timing</Text>
          <Text variant="body" color="secondary">
            Optional — helps businesses tailor their quote.
          </Text>
        </Stack>
        <Stack spacing="base">
          <TextField
            label="Budget (optional)"
            value={budget}
            onChangeText={setBudget}
            keyboardType="numeric"
            placeholder="e.g. 150"
          />
          <Inline spacing="sm" align="flex-start">
            <TextField
              label="Preferred date"
              value={date}
              onChangeText={setDate}
              placeholder="May 28"
              style={{ flex: 1 }}
            />
            <TextField
              label="Preferred time"
              value={time}
              onChangeText={setTime}
              placeholder="10:00 AM"
              style={{ flex: 1 }}
            />
          </Inline>
        </Stack>
      </Stack>
    </StepPanel>
  );
}

// ─── Step 3: Confirm ─────────────────────────────────────────────────────────
function StepConfirm({ category, description, address, budget, date, time, onSubmit, submitting }) {
  const rows = [
    { label: 'Category', value: category || 'General' },
    { label: 'Description', value: description || '—' },
    { label: 'Address', value: address || '—' },
    { label: 'Budget', value: budget ? `$${budget}` : '—' },
    { label: 'Date', value: date || '—' },
    { label: 'Time', value: time || '—' },
  ];

  return (
    <StepPanel direction={1}>
      <Stack spacing="lg">
        <Stack spacing="sm">
          <Text variant="display3">Ready to post?</Text>
          <Text variant="body" color="secondary">
            Review your details below — local businesses will see this and send quotes.
          </Text>
        </Stack>

        <Surface elevation="subtle" background="alt" rounded="card" padding="base">
          <Stack spacing="md">
            {rows.map(({ label, value }) => (
              <Inline key={label} justify="space-between" align="flex-start">
                <Text variant="label" color="secondary" style={{ flexShrink: 0, marginRight: spacing.sm }}>
                  {label}
                </Text>
                <Text
                  variant="small"
                  color="primary"
                  style={{ flex: 1, textAlign: 'right' }}
                  numberOfLines={3}
                >
                  {value}
                </Text>
              </Inline>
            ))}
          </Stack>
        </Surface>

        <Button
          label="Post job → get quotes"
          loading={submitting}
          disabled={submitting}
          onPress={onSubmit}
          style={styles.postBtn}
        />

        <Text variant="caption" color="secondary" style={styles.hint}>
          Local businesses will respond with quotes. You pick the best one.
        </Text>
      </Stack>
    </StepPanel>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function PostJobScreen() {
  const navigation = useNavigation();

  // Form state (preserved exactly as original)
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [budget, setBudget] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Wizard state
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [descError, setDescError] = useState('');

  // Navigate between steps
  function goForward() {
    if (step === 1 && !description.trim()) {
      setDescError('Please describe what you need.');
      return;
    }
    setDescError('');
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function goBack() {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }

  // Original submit logic — preserved in full
  async function handleSubmit() {
    if (!description.trim()) {
      setDescError('Please describe what you need.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.post('/service-posts/', {
        title: description.trim(),
        category: category || 'General',
        budget: budget ? parseFloat(budget) : null,
        preferred_date: date.trim() || null,
        preferred_time: time.trim() || null,
        address: address.trim() || null,
      });

      setDescription('');
      setCategory('');
      setAddress('');
      setBudget('');
      setDate('');
      setTime('');

      navigation.navigate('QuoteComparison', {
        postId: data.id,
        postTitle: data.title,
      });
    } catch (err) {
      // Show error on confirm step (inline, not Alert)
      setDescError(err.message || 'Could not post job. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const isLastStep = step === TOTAL_STEPS - 1;
  const isFirstStep = step === 0;

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step indicator */}
        <Stack spacing="sm" style={styles.progressSection}>
          <StepLabels step={step} />
          <ProgressBar step={step} />
        </Stack>

        {/* Step content — key forces remount & re-animation on each step */}
        <View style={styles.stepContent}>
          {step === 0 && (
            <StepCategory key="cat" category={category} setCategory={setCategory} />
          )}
          {step === 1 && (
            <StepDetails
              key="det"
              description={description}
              setDescription={setDescription}
              address={address}
              setAddress={setAddress}
              descError={descError}
            />
          )}
          {step === 2 && (
            <StepBudget
              key="bud"
              budget={budget}
              setBudget={setBudget}
              date={date}
              setDate={setDate}
              time={time}
              setTime={setTime}
            />
          )}
          {step === 3 && (
            <StepConfirm
              key="con"
              category={category}
              description={description}
              address={address}
              budget={budget}
              date={date}
              time={time}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          )}
        </View>

        {/* Back / Next navigation */}
        {!isLastStep && (
          <Inline justify="space-between" style={styles.navRow}>
            {!isFirstStep ? (
              <Button
                variant="ghost"
                label="← Back"
                onPress={goBack}
                style={styles.navBtn}
              />
            ) : (
              <View style={styles.navBtn} />
            )}
            <Button
              label={step === TOTAL_STEPS - 2 ? 'Review →' : 'Next →'}
              onPress={goForward}
              style={styles.navBtn}
            />
          </Inline>
        )}

        {/* Back button on confirm step */}
        {isLastStep && (
          <Button
            variant="ghost"
            label="← Edit details"
            onPress={goBack}
            style={styles.backOnConfirm}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  container: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },

  // Progress
  progressSection: { marginBottom: spacing.xs },
  progressTrack: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  stepLabels: { paddingHorizontal: spacing.xs },
  stepLabelActive: {},

  // Step content
  stepContent: { flex: 1, minHeight: 320 },

  // Navigation
  navRow: { marginTop: spacing.sm },
  navBtn: { flex: 1, maxWidth: 160 },
  backOnConfirm: { alignSelf: 'center', marginTop: spacing.sm },

  // Confirm step
  postBtn: { marginTop: spacing.xs },
  hint: { textAlign: 'center' },
});
