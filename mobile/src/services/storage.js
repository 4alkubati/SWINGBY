// Cross-platform secure-ish storage wrapper.
//
// expo-secure-store works on iOS (Keychain) and Android (Keystore) but NOT on
// web — its functions throw "is not a function" in the browser. This module
// presents the same API as expo-secure-store and routes to:
//
//   - expo-secure-store on iOS / Android (true hardware-backed storage)
//   - window.localStorage on web (plain text, acceptable for dev preview)
//
// API matches expo-secure-store so call sites only change their import line.
//
// SECURITY NOTE: on web, tokens are stored in localStorage which is readable
// by any JS on the page. This is fine for development. For a production web
// build, prefer httpOnly cookies issued by the backend.

import { Platform } from 'react-native';

let impl;

if (Platform.OS === 'web') {
  const hasLocalStorage =
    typeof window !== 'undefined' && !!window.localStorage;

  impl = {
    async setItemAsync(key, value) {
      if (hasLocalStorage) {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          // Quota exceeded or storage disabled — silently drop.
        }
      }
    },
    async getItemAsync(key) {
      if (hasLocalStorage) {
        try {
          return window.localStorage.getItem(key);
        } catch {
          return null;
        }
      }
      return null;
    },
    async deleteItemAsync(key) {
      if (hasLocalStorage) {
        try {
          window.localStorage.removeItem(key);
        } catch {
          // Already gone or storage disabled.
        }
      }
    },
  };
} else {
  // Lazy require — only loads expo-secure-store when actually on native.
  // Prevents the web bundle from evaluating the native binding.
  impl = require('expo-secure-store');
}

export const setItemAsync = (key, value) => impl.setItemAsync(key, value);
export const getItemAsync = (key) => impl.getItemAsync(key);
export const deleteItemAsync = (key) => impl.deleteItemAsync(key);

export default { setItemAsync, getItemAsync, deleteItemAsync };
