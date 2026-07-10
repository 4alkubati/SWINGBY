import React, { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnread } from '../context/UnreadContext';
import { buttonTap } from '../services/haptics';
import Text from './Text';
import Badge from './Badge';
import { colors, spacing, motion, shadows } from '../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING_CFG = { stiffness: motion.spring.stiffness, damping: motion.spring.damping };

// Feather icon per tab. `raised: true` marks the center "Post a job" purple button.
const CLIENT_ICON_MAP = {
  Home: { icon: 'home' },
  'My Jobs': { icon: 'briefcase' },
  Post: { icon: 'plus', raised: true },
  Messages: { icon: 'message-circle' },
  Profile: { icon: 'user' },
};

const BUSINESS_ICON_MAP = {
  Dashboard: { icon: 'grid' },
  Jobs: { icon: 'briefcase' },
  Messages: { icon: 'message-circle' },
  'My Business': { icon: 'briefcase' },
  Earnings: { icon: 'trending-up' },
  Team: { icon: 'users' },
};

function isBusinessTabs(routes) {
  return routes.some((r) => r.name === 'Dashboard' || r.name === 'My Business');
}

function TabItem({ route, isActive, onPress, iconMap, totalUnread, raised }) {
  const scaleVal = useSharedValue(1);
  const cfg = iconMap[route.name] || { icon: 'circle' };
  const iconName = cfg.icon;
  const isMessages = route.name === 'Messages';
  const showBadge = isMessages && totalUnread > 0;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleVal.value }],
  }));

  const handlePressIn = () => {
    scaleVal.value = withSpring(0.9, SPRING_CFG);
  };
  const handlePressOut = () => {
    scaleVal.value = withSpring(1, SPRING_CFG);
  };
  const handlePress = () => {
    buttonTap();
    onPress(route.name);
  };

  if (raised) {
    return (
      <AnimatedPressable
        style={[styles.raisedWrap, animatedStyle]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Post a job"
      >
        <View style={[styles.raisedCircle, shadows.accentGlow]}>
          <Feather name="plus" size={26} color={colors.textPrimary} strokeWidth={2.2} />
        </View>
      </AnimatedPressable>
    );
  }

  const activeColor = isActive ? colors.accentText : colors.textSecondary;

  return (
    <AnimatedPressable
      style={[styles.tab, animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={route.name}
    >
      <View style={styles.iconWrapper}>
        <Feather
          name={iconName}
          size={21}
          color={activeColor}
          strokeWidth={isActive ? 2.2 : 1.8}
        />
        {showBadge && <Badge count={totalUnread} color="accent" style={styles.badge} />}
      </View>
      <Text
        variant="caption"
        style={[styles.label, { color: activeColor }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.2}
      >
        {route.name}
      </Text>
    </AnimatedPressable>
  );
}

export default function BottomNav({ state, navigation, tabs }) {
  const insets = useSafeAreaInsets();
  const { totalUnread } = useUnread();
  const isBusinessNav = isBusinessTabs(state.routes);
  const iconMap = isBusinessNav ? BUSINESS_ICON_MAP : CLIENT_ICON_MAP;

  const handleTabPress = useCallback(
    (routeName) => {
      // The center "+" is a virtual tab that navigates to PostJob rather than switching tab state.
      if (routeName === 'Post') {
        navigation.navigate('PostJob');
        return;
      }
      navigation.navigate(routeName);
    },
    [navigation],
  );

  // Insert a virtual "Post" tab in the middle of the client nav
  const routes = React.useMemo(() => {
    if (isBusinessNav) return state.routes.map((r) => ({ key: r.key, name: r.name }));
    const mid = Math.floor(state.routes.length / 2);
    const withPost = [...state.routes.map((r) => ({ key: r.key, name: r.name }))];
    withPost.splice(mid, 0, { key: '__post__', name: 'Post' });
    return withPost;
  }, [state.routes, isBusinessNav]);

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, spacing.sm) },
      ]}
    >
      {routes.map((route, idx) => {
        const realIndex = state.routes.findIndex((r) => r.name === route.name);
        const isActive = realIndex === state.index && route.name !== 'Post';
        return (
          <TabItem
            key={route.key || `${route.name}-${idx}`}
            route={route}
            isActive={isActive}
            onPress={handleTabPress}
            iconMap={iconMap}
            totalUnread={totalUnread}
            raised={route.name === 'Post'}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#0A0B0E',
  },
  tab: {
    alignItems: 'center',
    gap: 3,
    minWidth: 56,
    paddingTop: spacing.xs,
  },
  iconWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  raisedWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
  },
  raisedCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
