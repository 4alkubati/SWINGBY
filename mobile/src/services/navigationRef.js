// navigationRef.js — a handle onto the root NavigationContainer usable from
// OUTSIDE any screen component (App.js module scope, push-notification
// callbacks). React Navigation's own `useNavigation()` only works inside the
// tree it renders; a tapped push notification fires from a native callback
// that isn't inside that tree, so it needs this instead. See
// services/notifications.js::registerNotificationResponseHandler (F118).
// Imported from @react-navigation/core, not @react-navigation/native: the
// installed native@6.1.18's compiled index.js only re-exports a fixed list
// (NavigationContainer, Link, theme helpers, ...) and does not forward
// createNavigationContainerRef, even though core (a guaranteed dependency of
// native, currently 6.4.17 here) has always shipped it. Importing from core
// directly is what actually resolves at runtime; importing from native throws
// "createNavigationContainerRef is not a function".
import { createNavigationContainerRef } from '@react-navigation/core';

export const navigationRef = createNavigationContainerRef();

export function navigateFromNotification(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}
