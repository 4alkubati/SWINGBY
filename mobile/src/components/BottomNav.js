import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CLIENT_TABS = [
  { name: 'Home',     icon: '🏠' },
  { name: 'My Jobs',  icon: '📄' },
  { name: 'Messages', icon: '💬' },
  { name: 'Profile',  icon: '👤' },
];

const BUSINESS_TABS = [
  { name: 'Dashboard',   icon: '📊' },
  { name: 'Jobs',        icon: '📄' },
  { name: 'Messages',    icon: '💬' },
  { name: 'My Business', icon: '🏢' },
];

export default function BottomNav({ state, navigation, tabs }) {
  const insets = useSafeAreaInsets();
  const tabConfig = tabs || CLIENT_TABS;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {state.routes.map((route, index) => {
        const isActive = state.index === index;
        const config = tabConfig.find((t) => t.name === route.name) || { icon: '●' };

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.7}
          >
            <Text style={[styles.icon, isActive && styles.iconActive]}>
              {config.icon}
            </Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {route.name}
            </Text>
            {isActive && <View style={styles.dot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#111315',
    backgroundColor: '#07080a',
  },
  tab: {
    alignItems: 'center',
    gap: 3,
    minWidth: 56,
  },
  icon: {
    fontSize: 22,
    opacity: 0.25,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    fontSize: 10,
    color: '#3a424c',
    fontWeight: '600',
  },
  labelActive: {
    color: '#FF5C00',
  },
  dot: {
    width: 4,
    height: 4,
    backgroundColor: '#FF5C00',
    borderRadius: 2,
    marginTop: 1,
  },
});
