import { useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { completeAuthFromUrl } from '../services/authLink';
import * as toast from '../services/toast';

// useAuthDeepLink — catch a confirmation link arriving from outside the app.
//
// `Linking.useURL()` covers both shapes that matter: the URL the app was cold
// -launched with (tapping the link with SwingBy closed, the common case for an
// email sent hours earlier) and one delivered while it is already running.
//
// Runs above navigation on purpose — see the header of services/authLink.js.
// Completing the session sets `user`, and RootNavigator swaps to the real app
// by itself, so this hook never navigates.
//
// @param {(profile:object)=>void} onSession — hand the profile to AuthContext.
// @param {boolean} alreadyLoggedIn — a session is live right now. A stray or
//   foreign auth-callback link tapped in that state must not touch it (see
//   the header of services/authLink.js) — skip the exchange entirely rather
//   than relying on the failure path to clean up after itself.
// @returns {{busy:boolean}} so the caller can hold a splash instead of flashing
//   the login screen for the moment the exchange is in flight.
export function useAuthDeepLink(onSession, alreadyLoggedIn) {
  const url = Linking.useURL();
  const [busy, setBusy] = useState(false);
  // A cold launch re-delivers the same URL on remount, and useURL keeps
  // returning it. Consuming a link twice would fire a second /auth/me and,
  // on the error path, a second toast at the client.
  const seen = useRef(new Set());
  const onSessionRef = useRef(onSession);
  onSessionRef.current = onSession;
  const loggedInRef = useRef(alreadyLoggedIn);
  loggedInRef.current = alreadyLoggedIn;

  useEffect(() => {
    if (!url || seen.current.has(url)) return;
    // A live session is already in this app — do not let a stray or foreign
    // confirmation link overwrite it. Deliberately NOT added to `seen`: if
    // the user later logs out, the same link (still returned by useURL)
    // should get its normal chance to be consumed.
    if (loggedInRef.current) return;
    seen.current.add(url);

    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const result = await completeAuthFromUrl(url);
        // null = an ordinary deep link (a booking, an invite). Not ours;
        // linkingConfig will route it. Leave the session alone.
        if (result && !cancelled) {
          onSessionRef.current?.(result.profile, result.accessToken);
          toast.show({ type: 'success', text1: "You're signed in" });
        }
      } catch (err) {
        if (!cancelled) {
          toast.show({
            type: 'error',
            text1: 'That link did not work',
            text2: err?.message,
          });
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { busy };
}

export default useAuthDeepLink;
