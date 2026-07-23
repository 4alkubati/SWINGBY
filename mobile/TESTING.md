# Mobile render harness

Jest + `jest-expo` + `@testing-library/react-native`, wired for the **D6.4
pre-spend verification sweep**: proving screens/components actually **render and
function** on a fresh build of `main` before we pay for Apple Developer + the
monthly rail. Agents verify each checklist item against this rig.

## Run

```bash
cd mobile
npm test                    # whole suite
npm test StatusBadge        # one file / name pattern
npm run test:ci             # CI: no watch, serial
```

## Write a render proof

**Leaf / presentational component** — render directly:

```js
import { render } from '@testing-library/react-native';
import StatusBadge from '../StatusBadge';

it('renders the label', () => {
  const { getByText } = render(<StatusBadge label="En route" tone="accent" />);
  expect(getByText('En route')).toBeTruthy();
});
```

**Full screen** — wrap in the provider stack with `renderScreen`:

```js
import { renderScreen } from '../../../test-utils/renderWithProviders';
import SomeScreen from '../SomeScreen';

it('mounts', () => {
  const { getByText } = renderScreen(<SomeScreen />);
  expect(getByText('Heading')).toBeTruthy();
});
```

`renderScreen` provides SafeArea (fixed metrics) + NavigationContainer +
ThemeProvider — what nearly every screen assumes.

**Screen that fetches or reads Auth/Booking/Unread context** — mock the api
module at the top of the file (a manual mock lives at
`src/services/__mocks__/api.js`), then set per-test data:

```js
jest.mock('../../services/api');
import api from '../../services/api';

api.get.mockResolvedValueOnce({ id: 1, title: 'Deep clean' });
```

Wrap extra context providers via `renderScreen(<S/>, { extraWrapper: ui => <AuthProvider>{ui}</AuthProvider> })`.

## What's mocked (in `jest.setup.js`)

Native modules jsdom can't run are stubbed: `react-native-maps`,
`react-native-reanimated` + worklets, gesture-handler, async-storage,
`@sentry/react-native`, `react-native-google-places-autocomplete`,
`react-native-toast-message`, `@expo/vector-icons` (→ plain View, dodges the
`expo-font`/`expo-asset` chain), `expo-secure-store`, `expo-local-authentication`.
`jest-expo` auto-mocks the rest of `expo-*`.

Each mock is guarded — if a version bump moves a mock path, add the one package
that broke; the suite won't fall over wholesale.

## Limits (be honest in reports)

- This proves **render + logic**, not pixels/layout/gestures on a real device.
  A passing render test ≠ "looks right on an iPhone." Device spot-checks still
  belong to Kira for anything visual.
- Native-only behavior (maps tiles, biometrics prompt, push) is mocked, so those
  paths are verified as *wiring*, not as real native behavior.
