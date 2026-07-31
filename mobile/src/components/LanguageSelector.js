import React, { useRef, useEffect } from 'react';
import {
  View, TouchableOpacity, Modal, Animated, Alert,
  StyleSheet, Dimensions, TouchableWithoutFeedback,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from './Text';
import i18n, { setLocale } from '../i18n';
import { READY_LOCALES } from '../i18n-locales';
import { restartApp } from '../services/rtl';
import { colors, spacing } from '../theme/tokens';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Was a hardcoded pair. Arabic was fully translated — all 264 keys — and
// missing from this list, so it could only ever activate if the phone itself
// was Arabic: a newcomer on an English handset had no way to reach the Arabic
// app that already existed. The list is now the shared registry, which the
// device detector reads too, so the two cannot drift apart again.
const LANGUAGES = READY_LOCALES;

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

  // Switching between an LTR and an RTL language changes the NATIVE layout
  // direction, and native only reads that at process start. So the app has to
  // reload — a re-render leaves Arabic text sitting in a left-to-right layout,
  // which is how this app shipped Arabic until 2026-07-30.
  //
  // The user is warned first rather than having the app vanish under them: an
  // unexplained restart immediately after tapping a language reads as a crash.
  // If the reload cannot be performed (Expo Go and dev clients have updates
  // disabled), we say so plainly instead of leaving them on a half-flipped
  // screen wondering why it looks wrong.
  async function handleSelect(code) {
    const { needsRestart } = await setLocale(code);

    if (!needsRestart) {
      onClose(code);
      return;
    }

    const lang = LANGUAGES.find((l) => l.code === code);
    Alert.alert(
      i18n.t('language.restartTitle'),
      i18n.t('language.restartBody', { language: lang?.native || code }),
      [
        {
          text: i18n.t('language.restartNow'),
          onPress: async () => {
            const reloaded = await restartApp();
            if (!reloaded) {
              Alert.alert(
                i18n.t('language.restartTitle'),
                i18n.t('language.restartManual'),
              );
            }
            onClose(code);
          },
        },
      ],
      { cancelable: false },
    );
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
