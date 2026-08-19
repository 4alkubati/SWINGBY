/**
 * no-inlined-maps-key.test.js — SB-0029.
 *
 * Anything named `EXPO_PUBLIC_*` is INLINED into the published JS bundle by
 * Expo. app.config.js therefore reads the Google Maps key as
 * `GOOGLE_MAPS_API_KEY`, with no prefix, and says so — it is consumed natively,
 * never from JS.
 *
 * PostJobScreen used to fall back to `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` when
 * looking for a Places key. That quietly reopened the thing app.config.js was
 * avoiding: set the obvious-looking variable to fix dead autocomplete, and the
 * Maps key ships in plaintext in every bundle. A key from this project has
 * already been published once and not rotated (SB-0023).
 *
 * This test is a grep with a reason attached, and that is the right shape:
 * the failure mode is a NAME appearing in source, and it can reappear in any
 * file at any time.
 */
const fs = require('fs')
const path = require('path')

const SRC_DIR = path.join(__dirname, '..')

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(full)
    return /\.(js|jsx)$/.test(entry.name) ? [full] : []
  })
}

describe('the Maps key is never reachable from JS', () => {
  it('no source file READS EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', () => {
    // Checks for USE, not mention. PostJobScreen names the variable in a
    // comment explaining why it must not be read, and that explanation is the
    // thing most likely to stop someone re-adding it.
    const USE = /process\.env\.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY/
    const offenders = walk(SRC_DIR)
      .filter((file) => {
        const src = fs.readFileSync(file, 'utf8')
        const code = src
          .split('\n')
          .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
          .join('\n')
        return USE.test(code)
      })
      .map((file) => path.relative(SRC_DIR, file))
    expect(offenders).toEqual([])
  })

  it('app.config.js still reads the unprefixed name', () => {
    const config = fs.readFileSync(
      path.join(SRC_DIR, '..', 'app.config.js'),
      'utf8',
    )
    expect(config).toMatch(/process\.env\.GOOGLE_MAPS_API_KEY/)
    expect(config).not.toMatch(/process\.env\.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY/)
  })
})
