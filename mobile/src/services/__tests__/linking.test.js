// F091 — the beta invite deep link registered was 'invite/:code' (a path
// segment), but every real invite link sent to a tester is the QUERY form:
// swingby://invite?code=<CODE> (see BetaInviteCardScreen.js, i18n.js
// 'invite.hero' block). getStateFromPath's path matcher requires a matching
// number of path segments — 'invite/:code' does not match a bare 'invite'
// with no second segment, so the real link silently failed to route anywhere.
// This exercises the actual React Navigation matcher, not just the config
// source text, so it would have caught the original bug.
import { getStateFromPath } from '@react-navigation/core';
import { linkingConfig } from '../linking';

function focusedRouteName(url) {
  // getStateFromPath takes the path AFTER prefix-stripping — that stripping is
  // normally done by NavigationContainer itself using linkingConfig.prefixes
  // before this function ever runs. Mirror that here.
  const path = linkingConfig.prefixes.reduce(
    (acc, prefix) => (acc.startsWith(prefix) ? acc.slice(prefix.length) : acc),
    url,
  );
  const state = getStateFromPath(path, linkingConfig.config);
  if (!state) return null;
  let route = state.routes[state.index ?? state.routes.length - 1];
  while (route?.state) {
    route = route.state.routes[route.state.index ?? route.state.routes.length - 1];
  }
  return route;
}

describe('the beta invite deep link', () => {
  it('resolves swingby://invite?code=<CODE> (the real link shape) to BetaInvite with the code', () => {
    const route = focusedRouteName('swingby://invite?code=SWING-A7X3');
    expect(route?.name).toBe('BetaInvite');
    expect(route?.params).toMatchObject({ code: 'SWING-A7X3' });
  });

  it('still resolves the bare invite link with no code, per the "no-code state" the screen handles', () => {
    const route = focusedRouteName('swingby://invite');
    expect(route?.name).toBe('BetaInvite');
  });
});
