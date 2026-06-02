import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Text from './Text';
import { buttonTap } from '../services/haptics';
import { colors, spacing, radius, motion } from '../theme/tokens';

export default function Tabs({ tabs, activeIndex = 0, onChange, style }) {
  const [tabWidths, setTabWidths] = useState([]);
  const indicatorX = useSharedValue(0);

  const handleLayout = (index, event) => {
    const { x, width } = event.nativeEvent.layout;
    setTabWidths((prev) => {
      const next = [...prev];
      next[index] = { x, width };
      return next;
    });
  };

  const handlePress = (index) => {
    if (index === activeIndex) return;
    buttonTap();
    if (tabWidths[index]) {
      indicatorX.value = withSpring(tabWidths[index].x, {
        stiffness: motion.spring.stiffness,
        damping: motion.spring.damping,
      });
    }
    onChange?.(index);
  };

  const indicatorStyle = useAnimatedStyle(() => {
    const activeTab = tabWidths[activeIndex];
    return {
      transform: [{ translateX: indicatorX.value }],
      width: activeTab?.width || 0,
    };
  });

  // Initialize indicator position
  React.useEffect(() => {
    if (tabWidths[activeIndex]) {
      indicatorX.value = withSpring(tabWidths[activeIndex].x, {
        stiffness: motion.spring.stiffness,
        damping: motion.spring.damping,
      });
    }
  }, [activeIndex, tabWidths]);

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          backgroundColor: colors.surface,
          borderRadius: radius.input,
          padding: spacing.xs,
          position: 'relative',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: spacing.xs,
            bottom: spacing.xs,
            backgroundColor: colors.accent,
            borderRadius: radius.chip,
          },
          indicatorStyle,
        ]}
      />
      {tabs.map((tab, index) => (
        <Pressable
          key={tab}
          onLayout={(e) => handleLayout(index, e)}
          onPress={() => handlePress(index)}
          accessibilityRole="tab"
          accessibilityLabel={tab}
          accessibilityState={{ selected: index === activeIndex }}
          style={{
            flex: 1,
            alignItems: 'center',
            paddingVertical: spacing.sm,
          }}
        >
          <Text
            variant="smallMedium"
            color={index === activeIndex ? 'primary' : 'secondary'}
            maxFontSizeMultiplier={1.3}
          >
            {tab}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
