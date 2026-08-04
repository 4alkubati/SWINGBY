// Dead-nav-route guard.
//
// The bug: BusinessNavigator registered 21 routes but not `ProfileEdit` and not
// `BusinessProfile`. SettingsScreen's "Edit profile" row and the company link on
// BookingDetails / EmployeeProfile / Chat are shared between both navigators, so
// a business user tapped them and nothing happened — in production.
//
// Why this test and not tools/flow_graph.py: flow_graph checks every
// navigate() target against the UNION of all navigators' routes. `ProfileEdit`
// existed in ClientNavigator, so the graph reported "broken edges: 0" while the
// button was dead for every business user. Route resolution is PER NAVIGATOR,
// so the check has to be per navigator too.

import fs from 'fs';
import path from 'path';

const NAV_DIR = path.join(__dirname, '..', 'navigation');

function registeredRoutes(navFile) {
  const src = fs.readFileSync(path.join(NAV_DIR, navFile), 'utf8');
  const routes = new Set();
  const re = /<(?:Stack|Tab)\.Screen\s+name=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src)) !== null) routes.add(m[1]);
  return routes;
}

describe('BusinessNavigator route registry', () => {
  const routes = registeredRoutes('BusinessNavigator.js');

  it.each([
    // SettingsScreen row "Edit profile" — business owners and employees had no
    // way to change their own name / phone / photo at all without this.
    ['ProfileEdit', 'SettingsScreen "Edit profile"'],
    // The company link on BookingDetails, EmployeeProfile and Chat.
    ['BusinessProfile', 'company link on BookingDetails / EmployeeProfile'],
  ])('registers %s (used by %s)', (route) => {
    expect([...routes]).toContain(route);
  });

  it('still registers everything it had before', () => {
    for (const route of [
      'BusinessTabs', 'JobManagement', 'Chat', 'EmployeeManagement',
      'EmployeeProfile', 'Earnings', 'BusinessAnalytics', 'Settings',
      'PrivacyPolicy', 'TermsOfService', 'HelpFAQ', 'NotificationsCenter',
      'BookingDetails', 'MessageThread', 'PaymentMethod', 'DisputeFlow',
      'Invoice', 'BusinessInvoices',
      // D5 — the payout screen. Registered in BusinessNavigator only: it is
      // the one screen that moves the company's money out, and the backend
      // 403s any role but business_owner.
      'Wallet',
    ]) {
      expect([...routes]).toContain(route);
    }
  });

  it('registers no route name twice', () => {
    const src = fs.readFileSync(path.join(NAV_DIR, 'BusinessNavigator.js'), 'utf8');
    const stackNames = [...src.matchAll(/<Stack\.Screen\s+name=["']([^"']+)["']/g)].map((m) => m[1]);
    expect(new Set(stackNames).size).toBe(stackNames.length);
  });
});

describe('ClientNavigator route registry', () => {
  const routes = registeredRoutes('ClientNavigator.js');

  it('registers ProfileEdit (the row exists in the shared SettingsScreen)', () => {
    expect([...routes]).toContain('ProfileEdit');
  });

  it('registers BusinessProfile', () => {
    expect([...routes]).toContain('BusinessProfile');
  });
});

describe('AuthNavigator route registry', () => {
  // The consent checkbox on Signup (and the notice on Login) link to the Terms
  // and the Privacy Policy. Both screens were registered ONLY in the two
  // logged-in navigators, so from the auth stack both links threw — for the one
  // audience that is being asked to agree to them, and for the App Store
  // reviewer who taps them first.
  const routes = registeredRoutes('AuthNavigator.js');

  it.each([['TermsOfService'], ['PrivacyPolicy']])(
    'registers %s so the consent links resolve while logged out',
    (route) => {
      expect([...routes]).toContain(route);
    },
  );

  it('still registers the screens it had before', () => {
    for (const route of ['Onboarding', 'Login', 'Signup', 'ForgotPassword']) {
      expect([...routes]).toContain(route);
    }
  });
});

describe('shared screens do not strand business users', () => {
  it('SettingsScreen "Edit profile" resolves in BOTH navigators', () => {
    const settings = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'shared', 'SettingsScreen.js'),
      'utf8'
    );
    expect(settings).toMatch(/navigate\(['"]ProfileEdit['"]\)/);
    for (const nav of ['BusinessNavigator.js', 'ClientNavigator.js']) {
      expect([...registeredRoutes(nav)]).toContain('ProfileEdit');
    }
  });
});
