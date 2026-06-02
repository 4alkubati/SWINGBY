// T36 — OnboardingScreen full redesign (Sleek UX Pass)
import React, { useRef, useState, useCallback } from 'react';
import { View, FlatList, Dimensions, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';
import { colors, spacing, radius } from '../theme/tokens';
import Text from '../components/Text';
import Button from '../components/Button';

const { width: SCREEN_W } = Dimensions.get('window');
const ONBOARDING_KEY = 'has_seen_onboarding';

const SLIDES = [
  {
    id: '1',
    icon: 'search-outline',
    title: 'Find trusted professionals',
    subtitle: 'Browse nearby verified service providers in your area',
  },
  {
    id: '2',
    icon: 'document-text-outline',
    title: 'Post a job, get quotes',
    subtitle: 'Describe what you need and compare competitive quotes',
  },
  {
    id: '3',
    icon: 'shield-checkmark-outline',
    title: 'Book with confidence',
    subtitle: 'Secure payments and verified providers protect every booking',
  },
];

function SlideItem({ item }) {
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={{ width: SCREEN_W, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}
    >
      {/* Icon circle */}
      <View
        style={{
          width: 160,
          height: 160,
          borderRadius: radius.avatar,
          backgroundColor: colors.accentMuted,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing['2xl'],
        }}
      >
        <Ionicons name={item.icon} size={80} color={colors.accent} />
      </View>

      {/* Text block */}
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Text variant="display2" style={{ textAlign: 'center' }}>
          {item.title}
        </Text>
        <Text
          variant="body"
          color="secondary"
          style={{ textAlign: 'center', maxWidth: 280 }}
        >
          {item.subtitle}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function OnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const flatRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  async function finish() {
    try {
      await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
    } catch { /* non-fatal */ }
    navigation.navigate('Login');
  }

  function handleNext() {
    if (activeIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  }

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }, []);

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top,
      }}
    >
      {/* Skip — top right, hidden on last slide */}
      {!isLast && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={{
            position: 'absolute',
            top: insets.top + spacing.sm,
            right: spacing.lg,
            zIndex: 10,
          }}
        >
          <Pressable
            onPress={finish}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            accessibilityHint="Goes directly to the login screen"
          >
            <Text variant="smallMedium" color="secondary">
              Skip
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Carousel */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        renderItem={({ item }) => <SlideItem item={item} />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={{ flex: 1 }}
      />

      {/* Bottom zone — dots + CTA */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.base,
          paddingBottom: insets.bottom + spacing.lg,
          gap: spacing.lg,
          alignItems: 'center',
        }}
      >
        {/* Pagination dots */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                height: 8,
                borderRadius: radius.pill,
                width: i === activeIndex ? 24 : 8,
                backgroundColor: i === activeIndex ? colors.accent : colors.border,
              }}
            />
          ))}
        </View>

        {/* Action button */}
        {isLast ? (
          <Animated.View entering={FadeIn.duration(250)} style={{ width: '100%' }}>
            <Button
              label="Get Started"
              variant="primary"
              onPress={finish}
              style={{ width: '100%' }}
            />
          </Animated.View>
        ) : (
          <Pressable
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel="Next slide"
            style={({ pressed }) => ({
              width: '100%',
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.button,
              paddingVertical: spacing.base,
              alignItems: 'center',
              minHeight: 52,
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Text variant="bodyMedium" maxFontSizeMultiplier={1.3}>Next</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
