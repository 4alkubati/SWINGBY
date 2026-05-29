// T42 — Haptic feedback helpers
import * as Haptics from 'expo-haptics';

/** Light tap — use on button presses */
export async function buttonTap() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (_) {
    // no-op on web / simulator
  }
}

/** Success notification haptic */
export async function successTap() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (_) {
    // no-op on web / simulator
  }
}

/** Error notification haptic */
export async function errorTap() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (_) {
    // no-op on web / simulator
  }
}

/** Warning notification haptic */
export async function warningTap() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch (_) {
    // no-op on web / simulator
  }
}
