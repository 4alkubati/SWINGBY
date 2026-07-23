// Standard render wrapper for screen-level "does it render" proofs (D6.4).
//
// Wraps a screen in the providers almost every screen assumes exist:
//   - SafeAreaProvider  (useSafeAreaInsets)      — fixed metrics, no async measure
//   - NavigationContainer (useNavigation/useRoute) — real container so hooks work
//   - ThemeProvider     (theme tokens/context)
//
// Screens that read Auth/Booking/Unread context or fetch on mount also need
// those providers + the api mock. For those, mock the api module at the top of
// the test file:  jest.mock('../../services/api');  and wrap with the extra
// providers via the `extraWrapper` option below.
//
// Usage:
//   import { renderScreen } from '../../test-utils/renderWithProviders';
//   const { getByText } = renderScreen(<SomeScreen />);
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from '../theme/ThemeProvider';

// Fixed frame so useSafeAreaInsets resolves synchronously (no measurement race).
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function renderScreen(ui, { extraWrapper, ...options } = {}) {
  const inner = extraWrapper ? extraWrapper(ui) : ui;
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <NavigationContainer>{inner}</NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>,
    options
  );
}

export * from '@testing-library/react-native';
