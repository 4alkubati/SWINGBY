// T70 — LanguageSelector bottom-sheet modal
import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Animated,
  StyleSheet, Dimensions, TouchableWithoutFeedback,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import i18n, { setLocale } from '../i18n';

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
        {/* Handle */}
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
                activeOpacity={0.75}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.langLabel, selected && styles.langLabelActive]}>
                    {lang.native}
                  </Text>
                  <Text style={styles.langSub}>{lang.label}</Text>
                </View>
                {selected && (
                  <Feather name="check" size={18} color="#FF5C00" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => onClose(null)}
          activeOpacity={0.75}
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
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0d0f10',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#1a1d1f',
    paddingBottom: 32,
    paddingTop: 12,
    paddingHorizontal: 22,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2a2e33',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#131618',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  rowActive: {
    backgroundColor: 'rgba(255,92,0,0.10)',
    borderColor: 'rgba(255,92,0,0.25)',
  },
  rowText: {
    gap: 2,
  },
  langLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f0ede8',
  },
  langLabelActive: {
    color: '#ffffff',
  },
  langSub: {
    fontSize: 12,
    color: '#6b7280',
  },
  cancelBtn: {
    marginTop: 16,
    backgroundColor: '#131618',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 44,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9ca3af',
  },
});
