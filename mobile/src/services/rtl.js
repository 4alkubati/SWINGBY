// Right-to-left layout, for the Arabic app that already exists.
//
// Arabic has been fully translated for weeks and has been rendering
// LEFT-TO-RIGHT the whole time, because nothing in this app has ever called
// I18nManager. Translating the strings is only half of shipping a language:
// with the wrong direction the words are Arabic but the layout is not — back
// arrows point away from back, the avatar sits opposite its name, chevrons
// point out of the row they belong to, and prices land on the wrong side of
// their labels. To an Arabic reader that is not "slightly off", it reads as
// broken.
//
// THE ONE THING THAT MAKES THIS AWKWARD
// `I18nManager.forceRTL()` does not take effect when you call it. The native
// layout direction is read ONCE at process start, so the call only sets a
// persisted native flag; the running UI keeps the direction it booted with.
// A full RELOAD is required — not a re-render, not a navigation reset.
//
// That is why switching language here restarts the app instead of quietly
// re-rendering. Anything else produces a half-flipped screen, which is worse
// than either direction on its own.
//
// The flag persists natively across launches, so this is normally a one-time
// cost the first time somebody picks Arabic (or leaves it).
import { I18nManager } from 'react-native';

import { isRTL } from '../i18n-locales';

/**
 * `textAlign` for "the edge the line ENDS on" — right in English, left in Arabic.
 *
 * React Native's `textAlign` takes only physical values: checked against
 * RN 0.81.5's own StyleSheetTypes, it is
 * `'auto' | 'left' | 'right' | 'center' | 'justify'` — there is no `start`/`end`
 * the way flexbox has `marginStart`/`marginEnd`. And RN does NOT flip it for
 * you: there is no RTL handling for textAlign anywhere in the native text
 * views on either platform. A literal `textAlign: 'right'` therefore stays
 * hard right in Arabic, which drags every price and every timestamp to the
 * wrong end of its row.
 *
 * A CONSTANT rather than a function, and that is safe for exactly one reason:
 * layout direction cannot change without restarting the app (see the header
 * note), so this is fixed for the lifetime of the process. If that restart
 * requirement is ever removed, this has to become a hook.
 */
export const TEXT_END = I18nManager.isRTL ? 'left' : 'right';

/** Does the running app's layout direction already match this locale? */
export function directionMatches(locale) {
  return I18nManager.isRTL === isRTL(locale);
}

/**
 * Line the NATIVE direction flag up with `locale`.
 *
 * Returns true when the flag had to change — meaning the running UI is now
 * stale and the app has to be reloaded before it looks right. Returns false
 * when nothing changed and no restart is needed.
 *
 * `allowRTL(true)` is unconditional and deliberate: without it a `forceRTL`
 * call is ignored on iOS, which fails silently and looks exactly like "RTL
 * doesn't work".
 */
export function applyDirection(locale) {
  const want = isRTL(locale);

  I18nManager.allowRTL(true);

  if (I18nManager.isRTL === want) return false;

  I18nManager.forceRTL(want);
  return true;
}

/**
 * Restart the JS app so a direction change takes hold.
 *
 * Lazily required, and never allowed to throw. `Updates.reloadAsync()` rejects
 * when updates are disabled — which is the normal state in Expo Go and in a
 * dev client — and a language picker that crashes the app is a far worse bug
 * than one that asks the user to reopen it. The caller uses the boolean to
 * decide between "already handled" and "tell them to reopen the app".
 */
export async function restartApp() {
  try {
    // eslint-disable-next-line global-require
    const Updates = require('expo-updates');
    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}

/**
 * Boot-time sync: set the flag, never restart.
 *
 * Restarting during startup risks a reload loop on any platform where the
 * native flag does not persist (Expo Go being the one that matters), and a
 * boot loop is unrecoverable without deleting the app. In practice the flag
 * DOES persist, so a mismatch here only happens on the very first launch after
 * a locale was restored from storage — one launch in the wrong direction, then
 * correct forever after.
 *
 * The restart-now path belongs to the language picker, where the user has just
 * acted and a restart is explicable.
 */
export function syncDirectionOnBoot(locale) {
  try {
    return applyDirection(locale);
  } catch {
    return false;
  }
}
