import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useAnimatedProps,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnread } from '../context/UnreadContext';
import { buttonTap } from '../services/haptics';
import Text from './Text';
import Badge from './Badge';
import { colors, spacing, motion } from '../theme/tokens';

// ─── Animated primitives ───────────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ─── Icon maps ─────────────────────────────────────────────────────────────
const CLIENT_ICON_MAP = {
  Home:     { active: 'home',        inactive: 'home-outline' },
  'My Jobs': { active: 'briefcase',   inactive: 'briefcase-outline' },
  Messages: { active: 'chatbubble',  inactive: 'chatbubble-outline' },
  Profile:  { active: 'person',      inactive: 'person-outline' },
};

const BUSINESS_ICON_MAP = {
  Dashboard:    { active: 'grid',        inactive: 'grid-outline' },
  Jobs:         { active: 'briefcase',   inactive: 'briefcase-outline' },
  Messages:     { active: 'chatbubble', inactive: 'chatbubble-outline' },
  'My Business': { active: 'business',   inactive: 'business-outline' },
};

// ─── Tab configs ───────────────────────────────────────────────────────────
const CLIENT_TABS = [
  { name: 'Home' },
  { name: 'My Jobs' },
  { name: 'Messages' },
  { name: 'Profile' },
];

const BUSINESS_TABS = [
  { name: 'Dashboard' },
  { name: 'Jobs' },
  { name: 'Messages' },
  { name: 'My Business' },
];

// ─── Spring config (from tokens) ──────────────────────────────────────────
const SPRING_CFG = { stiffness: motion.spring.stiffness, damping: motion.spring.damping };

// ─── Individual tab item ───────────────────────────────────────────────────
function TabItem({ route, index, isActive, onPress, iconMap, totalUnread }) {
  const scaleVal = useSharedValue(1);

  const icons = iconMap[route.name] || { active: 'ellipse', inactive: 'ellipse-outline' };
  const iconName = isActive ? icons.active : icons.inactive;
  const isMessages = route.name === 'Messages';
  const showBadge = isMessages && totalUnread > 0;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleVal.value }],
  }));

  function handlePressIn() {
    scaleVal.value = withSpring(0.88, SPRING_CFG);
  }

  function handlePressOut() {
    scaleVal.value = withSpring(1, SPRING_CFG);
  }

  function handlePress() {
    buttonTap();
    onPress(route.name, index);
  }

  return (
    <AnimatedPressable
      key={route.key}
      style={[styles.tab, animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={route.name}
    >
      <View style={styles.iconWrapper}>
        <Ionicons
          name={iconName}
          size={22}
          color={isActive ? colors.accent : colors.textSecondary}
          style={isActive ? undefined : styles.iconInactive}
        />
        {showBadge && (
          <Badge
            count={totalUnread}
            color="accent"
            style={styles.badge}
          />
        )}
      </View>

      <Text
        variant="caption"
        style={[
          styles.label,
          { color: isActive ? colors.accent : colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {route.name}
      </Text>
    </AnimatedPressable>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export default function BottomNav({ state, navigation, tabs }) {
  const insets = useSafeAreaInsets();
  const tabConfig = tabs || CLIENT_TABS;
  const { totalUnread } = useUnread();

  // Detect which icon map to use based on tab names present
  const isBusinessNav = tabConfig.some((t) => t.name === 'Dashboard' || t.name === 'My Business');
  const iconMap = isBusinessNav ? BUSINESS_ICON_MAP : CLIENT_ICON_MAP;

  // Indicator bar animation
  const containerWidth = useRef(0);
  const indicatorX = useSharedValue(0);
  const tabCount = state.routes.length;

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  function handleLayout(e) {
    containerWidth.current = e.nativeEvent.layout.width;
    // Snap indicator to initial active tab without animation on first render
    const tabWidth = containerWidth.current / tabCount;
    const indicatorWidth = 20;
    indicatorX.value = tabWidth * state.index + (tabWidth - indicatorWidth) / 2;
  }

  const handleTabPress = useCallback(
    (routeName, index) => {
      const tabWidth = containerWidth.current / tabCount;
      const indicatorWidth = 20;
      indicatorX.value = withSpring(
        tabWidth * index + (tabWidth - indicatorWidth) / 2,
        SPRING_CFG,
      );
      navigation.navigate(routeName);
    },
    [navigation, tabCount, indicatorX],
  );

  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.base) }]}
      onLayout={handleLayout}
    >
      {/* Sliding active indicator bar */}
      <Animated.View style={[styles.indicator, indicatorStyle]} />

      {state.routes.map((route, index) => (
        <TabItem
          key={route.key}
          route={route}
          index={index}
          isActive={state.index === index}
          onPress={handleTabPress}
          iconMap={iconMap}
          totalUnread={totalUnread}
        />
      ))}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    position: 'relative',
  },
  // Animated sliding bar sits at the very top edge of the tab bar
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.accent,
  },
  tab: {
    alignItems: 'center',
    gap: spacing.xs - 1, // 3 px
    minWidth: 56,
    paddingTop: spacing.xs,
  },
  iconWrapper: {
    position: 'relative',
  },
  iconInactive: {
    opacity: 0.5,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
});
