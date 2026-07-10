import React, { useRef, useEffect } from 'react';
import {
  View, TouchableOpacity, Modal, Animated,
  StyleSheet, Dimensions, TouchableWithoutFeedback,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from './Text';
import i18n, { setLocale } from '../i18n';
import { colors, spacing } from '../theme/tokens';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'fr-CA', label: 'French (Canada)', native: 'Français (Canada)' },
];

export default function LanguageSelector({ visible, onClose, currentLocale }) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 160,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  async function handleSelect(code) {
    await setLocale(code);
    onClose(code);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => onClose(null)}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={() => onClose(null)}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />

        <Text style={styles.title}>Select Language</Text>

        <View style={styles.list}>
          {LANGUAGES.map((lang) => {
            const selected = (currentLocale || i18n.locale) === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.row, selected && styles.rowActive]}
                onPress={() => handleSelect(lang.code)}
                activeOpacity={0.85}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.langLabel, selected && styles.langLabelActive]}>
                    {lang.native}
                  </Text>
                  <Text style={styles.langSub}>{lang.label}</Text>
                </View>
                {selected && (
                  <Feather name="check" size={18} color={colors.accentText} strokeWidth={2.4} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => onClose(null)}
          activeOpacity={0.85}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlayScrim,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingBottom: 32,
    paddingTop: 12,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.md,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  rowActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.borderAccent,
  },
  rowText: {
    gap: 2,
  },
  langLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  langLabelActive: {
    color: colors.textPrimary,
  },
  langSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  cancelBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 44,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
