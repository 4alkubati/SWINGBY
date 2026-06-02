import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import Text from '../components/Text';
import Stack from '../components/Stack';
import Inline from '../components/Inline';
import Surface from '../components/Surface';
import Avatar from '../components/Avatar';
import Button from '../components/Button';
import TextField from '../components/TextField';
import { RatingStarsInput } from '../components/RatingStars';

import { api } from '../services/api';
import { successTap } from '../services/haptics';
import { colors, spacing, motion } from '../theme/tokens';

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

export default function ReviewScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { bookingId, workerId, workerName } = route.params || {};

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Spring scale for star section micro-interaction on rating change
  const starsScale = useSharedValue(1);

  const starsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: starsScale.value }],
  }));

  function handleRatingChange(star) {
    setRating(star);
    setError('');
    // Pulse scale up then settle back with spring
    starsScale.value = withSpring(1.12, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    }, () => {
      starsScale.value = withSpring(1, {
        stiffness: motion.spring.stiffness,
        damping: motion.spring.damping,
      });
    });
  }

  async function handleSubmit() {
    if (rating === 0) {
      setError('Please select a star rating before submitting.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.post('/reviews/', {
        booking_id: bookingId,
        reviewee_id: workerId,
        reviewee_type: 'business',
        rating,
        comment: comment.trim() || null,
      });
      await successTap();
      navigation.goBack();
    } catch (err) {
      setError(err.message || 'Could not submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      {/* Header */}
      <Inline
        spacing="sm"
        align="center"
        justify="space-between"
        style={{
          paddingHorizontal: spacing.base,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 32, alignItems: 'flex-start' }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text variant="h2" style={{ flex: 1, textAlign: 'center' }}>
          Leave a Review
        </Text>

        {/* Spacer to balance back button */}
        <View style={{ width: 32 }} />
      </Inline>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Stack spacing="lg">
          {/* Worker card */}
          <Surface elevation="subtle" background="default">
            <Stack spacing="sm" style={{ alignItems: 'center' }}>
              <Avatar name={workerName || 'Provider'} size="xl" />
              <Text variant="h2">{workerName || 'Your Provider'}</Text>
              <Text variant="small" color="secondary">
                How was your experience?
              </Text>
            </Stack>
          </Surface>

          {/* Star rating section */}
          <Stack spacing="sm" style={{ alignItems: 'center' }}>
            <Animated.View style={starsAnimatedStyle}>
              <RatingStarsInput
                value={rating}
                onChange={handleRatingChange}
                size={40}
              />
            </Animated.View>

            {rating > 0 && (
              <Text variant="smallMedium" color="accent">
                {RATING_LABELS[rating]}
              </Text>
            )}
          </Stack>

          {/* Comment field */}
          <TextField
            label="Comment (optional)"
            value={comment}
            onChangeText={(text) => {
              setComment(text);
              if (error) setError('');
            }}
            multiline
            textAlignVertical="top"
          />

          {/* Inline error */}
          {!!error && (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          )}

          {/* Submit button */}
          <Button
            variant="primary"
            label="Submit Review"
            onPress={handleSubmit}
            loading={submitting}
            disabled={rating === 0}
          />
        </Stack>
      </ScrollView>
    </View>
  );
}
