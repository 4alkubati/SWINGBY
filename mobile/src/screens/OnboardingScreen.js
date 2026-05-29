// T58 — OnboardingScreen (3-slide carousel)
import React, { useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Dimensions, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

const { width: SCREEN_W } = Dimensions.get('window');
const ONBOARDING_KEY = 'has_seen_onboarding';

const SLIDES = [
  {
    id: '1',
    title: 'Local pros, on demand',
    subtitle: 'Plumbing, cleaning, lawn, more — quoted by trusted local businesses.',
    icon: '⚡',
    glowColor: 'rgba(255,92,0,0.18)',
  },
  {
    id: '2',
    title: 'You set the day, they bid for it',
    subtitle: 'Post once. Compare quotes. Pick the best.',
    icon: '📋',
    glowColor: 'rgba(255,92,0,0.14)',
  },
  {
    id: '3',
    title: 'Verified workers, every time',
    subtitle: 'Photo proof on job complete. Escrow protects your payment.',
    icon: '🛡',
    glowColor: 'rgba(74,222,128,0.12)',
  },
];

function SlideItem({ item }) {
  return (
    <View style={[styles.slide, { width: SCREEN_W }]}>
      {/* Radial glow orb */}
      <View style={[styles.glowOrb, { backgroundColor: item.glowColor }]} />

      {/* Illustration area */}
      <View style={styles.illustrationWrap}>
        <View style={styles.illustrationCircle}>
          <View style={styles.illustrationInner}>
            <Text style={styles.illustrationIcon}>{item.icon}</Text>
          </View>
        </View>
        {/* Decorative ring */}
        <View style={styles.ring1} />
        <View style={styles.ring2} />
      </View>

      {/* Text */}
      <View style={styles.textBlock}>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
      </View>
    </View>
  );
}

export default function OnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const flatRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollX = useRef(new Animated.Value(0)).current;

  async function finish() {
    try {
      await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
    } catch { /* non-fatal */ }
    navigation.navigate('Login');
  }

  function handleNext() {
    if (activeIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      finish();
    }
  }

  function onViewableItemsChanged({ viewableItems }) {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
  const onViewRef = useRef(onViewableItemsChanged).current;

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Skip — top right */}
      <TouchableOpacity
        style={[styles.skipBtn, { top: insets.top + 12 }]}
        onPress={finish}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Carousel */}
      <Animated.FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        renderItem={({ item }) => <SlideItem item={item} />}
        onViewableItemsChanged={onViewRef}
        viewabilityConfig={viewabilityConfig}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        style={styles.flatList}
      />

      {/* Bottom 1/3 — dots + CTA */}
      <View style={[styles.bottomZone, { paddingBottom: insets.bottom + 24 }]}>
        {/* Page dots */}
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
          <TouchableOpacity style={styles.getStartedBtn} onPress={finish} activeOpacity={0.85}>
            <Text style={styles.getStartedText}>Get started</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.nextText}>Next →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080a',
  },
  skipBtn: {
    position: 'absolute',
    right: 22,
    zIndex: 10,
    paddingVertical: 4,
  },
  skipText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  flatList: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  glowOrb: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  illustrationWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  illustrationCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,92,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  illustrationInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,92,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationIcon: {
    fontSize: 44,
  },
  ring1: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.08)',
  },
  ring2: {
    position: 'absolute',
    width: 215,
    height: 215,
    borderRadius: 108,
    borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.04)',
  },
  textBlock: {
    alignItems: 'center',
    gap: 12,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.75,
    textAlign: 'center',
    lineHeight: 36,
  },
  slideSubtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  bottomZone: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 20,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#FF5C00',
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#2a2e33',
  },
  getStartedBtn: {
    width: '100%',
    backgroundColor: '#FF5C00',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    minHeight: 54,
  },
  getStartedText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  nextBtn: {
    width: '100%',
    backgroundColor: '#131618',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 54,
  },
  nextText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f0ede8',
  },
});
