import React, { useRef, useState, useCallback } from 'react';
import { View, FlatList, Dimensions, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, FadeInDown } from 'react-native-reanimated';
import * as SecureStore from '../../services/storage';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import Button from '../../components/Button';

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
    <View style={styles.slide}>
      <View style={styles.iconCircle}>
        <Ionicons name={item.icon} size={80} color={colors.accent} />
      </View>
      <View style={styles.slideText}>
        <Text style={styles.slideTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
          {item.title}
        </Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
      </View>
    </View>
  );
}

export default function OnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const flatRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  async function finish() {
    try { await SecureStore.setItemAsync(ONBOARDING_KEY, 'true'); } catch {}
    navigation.navigate('Login');
  }

  function handleNext() {
    if (activeIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  }

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index);
  }, []);

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.glowOrb} />

      {/* Skip */}
      {!isLast && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.skipWrap, { top: insets.top + spacing.sm }]}
        >
          <Pressable
            onPress={finish}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text style={styles.skipText}>Skip</Text>
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
        style={styles.flex}
      />

      {/* Bottom */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(200)}
        style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}
      >
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* CTA */}
        {isLast ? (
          <Animated.View entering={FadeIn.duration(250)} style={styles.ctaWrap}>
            <Button label="Get Started" variant="primary" onPress={finish} />
          </Animated.View>
        ) : (
          <Pressable
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel="Next slide"
            style={({ pressed }) => [styles.nextBtn, { opacity: pressed ? 0.75 : 1 }]}
          >
            <Text style={styles.nextBtnText}>Next</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },

  glowOrb: {
    position: 'absolute',
    top: -100,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.accentMuted,
    opacity: 0.3,
  },

  skipWrap: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 10,
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
  },

  slide: {
    width: SCREEN_W,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: radius.avatar,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  slideText: { alignItems: 'center', gap: spacing.sm },
  slideTitle: {
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  slideSubtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },

  bottom: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    gap: spacing.lg,
    alignItems: 'center',
  },
  dots: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 24, backgroundColor: colors.accent },
  dotInactive: { width: 6, backgroundColor: colors.border },

  ctaWrap: { width: '100%' },
  nextBtn: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  nextBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
});
