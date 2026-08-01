// A release build with no API URL used to ship pointing at localhost.
//
//   const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000';
//
// EXPO_PUBLIC_API_URL is inlined at BUILD time, and mobile/eas.json sets
// SENTRY_DISABLE_AUTO_UPLOAD in all four profiles and this variable in NONE of
// them — it has to come from the EAS environment. Miss it, or misspell it for
// one environment, and every request in the shipped app goes to the phone's own
// loopback address. Nothing failed at build time and nothing warned at startup;
// the user saw "Network Error" on every screen, which reads as a broken phone
// rather than a broken build.
//
// Two guards now, tested here:
//   1. app.config.js THROWS during a release build with no URL. This is the one
//      that matters — a warning inside a release bundle goes to a console
//      nobody is attached to.
//   2. services/api.js still falls back in dev (that is who it is for) and says
//      so loudly anywhere else.

import fs from 'fs';
import path from 'path';

const MOBILE = path.join(__dirname, '..', '..');

describe('app.config.js fails the build rather than shipping a dead app', () => {
  const configPath = path.join(MOBILE, 'app.config.js');

  function loadConfig(env) {
    jest.resetModules();
    const saved = { ...process.env };
    Object.assign(process.env, env);
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const factory = require(configPath);
      return factory({ config: { plugins: [] } });
    } finally {
      for (const k of Object.keys(env)) delete process.env[k];
      Object.assign(process.env, saved);
    }
  }

  it.each([['preview'], ['testflight'], ['production']])(
    'throws for the %s profile when EXPO_PUBLIC_API_URL is missing',
    (profile) => {
      expect(() => loadConfig({ EAS_BUILD_PROFILE: profile })).toThrow(
        /EXPO_PUBLIC_API_URL is not set/,
      );
    },
  );

  it('names the command that fixes it', () => {
    // A build failure that does not say what to do is a build failure you
    // disable.
    expect(() => loadConfig({ EAS_BUILD_PROFILE: 'production' })).toThrow(
      /eas env:create/,
    );
  });

  it('builds fine once the URL is set', () => {
    expect(() =>
      loadConfig({
        EAS_BUILD_PROFILE: 'production',
        EXPO_PUBLIC_API_URL: 'https://api.example.com',
      }),
    ).not.toThrow();
  });

  it('never blocks local development', () => {
    // `expo start` and dev-client builds set no profile, and a developer
    // running the backend on localhost is exactly who the fallback is for.
    expect(() => loadConfig({})).not.toThrow();
    expect(() => loadConfig({ EAS_BUILD_PROFILE: 'development' })).not.toThrow();
  });
});

describe('services/api.js', () => {
  const src = fs.readFileSync(path.join(MOBILE, 'src', 'services', 'api.js'), 'utf8');

  it('still has a localhost fallback for development', () => {
    expect(src).toMatch(/127\.0\.0\.1:8000/);
  });

  it('reports the missing URL instead of silently using loopback', () => {
    expect(src).toMatch(/API_URL_MISSING/);
    expect(src).toMatch(/__DEV__/);
  });
});
