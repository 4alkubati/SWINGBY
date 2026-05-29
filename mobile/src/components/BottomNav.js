import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnread } from '../context/UnreadContext';

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
  const { totalUnread } = useUnread();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {state.routes.map((route, index) => {
        const isActive = state.index === index;
        const config = tabConfig.find((t) => t.name === route.name) || { icon: '●' };
        const isMessages = route.name === 'Messages';
        const showBadge = isMessages && totalUnread > 0;
        const badgeLabel = totalUnread > 9 ? '9+' : String(totalUnread);

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.7}
          >
            <View style={styles.iconWrapper}>
              <Text style={[styles.icon, isActive && styles.iconActive]}>
                {config.icon}
              </Text>
              {showBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badgeLabel}</Text>
                </View>
              )}
            </View>
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
  iconWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    backgroundColor: '#FF5C00',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#07080a',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 11,
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
