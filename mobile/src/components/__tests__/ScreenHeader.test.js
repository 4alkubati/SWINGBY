// design/SPEC-screen-header.md — the single back/title/trailing bar every
// pushed screen renders instead of hand-drawing its own.
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ScreenHeader, { HEADER_TAP_TARGET } from '../ScreenHeader';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderHeader(props) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ScreenHeader {...props} />
    </SafeAreaProvider>,
  );
}

describe('ScreenHeader', () => {
  it('renders the title', () => {
    const { getByText } = renderHeader({ title: 'Booking Details', onBack: () => {} });
    expect(getByText('Booking Details')).toBeTruthy();
  });

  it('calls onBack when the back control is pressed (push variant)', () => {
    const onBack = jest.fn();
    const { getByLabelText } = renderHeader({ title: 'Settings', onBack });
    fireEvent.press(getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('defaults to the push variant: arrow-left icon, "Back" label', () => {
    const { getByLabelText, queryByLabelText } = renderHeader({
      title: 'Settings',
      onBack: () => {},
    });
    expect(getByLabelText('Back')).toBeTruthy();
    expect(queryByLabelText('Close')).toBeNull();
  });

  it('modal variant renders "x" / "Close", and still calls the same onBack prop', () => {
    const onBack = jest.fn();
    const { getByLabelText, queryByLabelText } = renderHeader({
      title: 'Send terms',
      onBack,
      variant: 'modal',
    });
    expect(queryByLabelText('Back')).toBeNull();
    fireEvent.press(getByLabelText('Close'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('omits the trailing action entirely when trailingIcon is not passed', () => {
    const { queryByLabelText } = renderHeader({ title: 'Settings', onBack: () => {} });
    expect(queryByLabelText('More options')).toBeNull();
  });

  it('renders a trailing action and fires its own handler, independent of onBack', () => {
    const onBack = jest.fn();
    const onTrailingPress = jest.fn();
    const { getByLabelText } = renderHeader({
      title: 'Chat',
      onBack,
      trailingIcon: 'more-vertical',
      onTrailingPress,
      trailingAccessibilityLabel: 'Thread options',
    });
    fireEvent.press(getByLabelText('Thread options'));
    expect(onTrailingPress).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('warns in __DEV__ if trailingIcon is passed without an accessibility label', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderHeader({
      title: 'Chat',
      onBack: () => {},
      trailingIcon: 'more-vertical',
      onTrailingPress: () => {},
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('gives the back and trailing controls a 44x44 tap target regardless of icon size', () => {
    const { getByLabelText } = renderHeader({
      title: 'Chat',
      onBack: () => {},
      trailingIcon: 'more-vertical',
      onTrailingPress: () => {},
      trailingAccessibilityLabel: 'Thread options',
    });
    const flatten = (style) => Object.assign({}, ...[].concat(style).filter(Boolean));
    const back = flatten(getByLabelText('Back').props.style);
    const trailing = flatten(getByLabelText('Thread options').props.style);
    expect(back.width).toBe(HEADER_TAP_TARGET);
    expect(back.height).toBe(HEADER_TAP_TARGET);
    expect(trailing.width).toBe(HEADER_TAP_TARGET);
    expect(trailing.height).toBe(HEADER_TAP_TARGET);
  });

  it('overrides the h1 title to an unset lineHeight so 2.0x accessibility text is not clipped', () => {
    // typeScale.h1 hardcodes lineHeight: 26 against a fontSize RN scales with
    // the OS text-size setting but never scales a fixed lineHeight to match —
    // at 2.0x a ~40px glyph would clip inside the un-scaled 26px box. See
    // design/SPEC-screen-header.md §8.
    const { getByText } = renderHeader({ title: 'Booking Details', onBack: () => {} });
    const flatten = (style) => Object.assign({}, ...[].concat(style).filter(Boolean));
    const titleStyle = flatten(getByText('Booking Details').props.style);
    expect(titleStyle.lineHeight).toBeUndefined();
    expect(titleStyle.fontSize).toBe(20);
  });

  it('passes testID through', () => {
    const { getByTestId } = renderHeader({
      title: 'Settings',
      onBack: () => {},
      testID: 'screen-header',
    });
    expect(getByTestId('screen-header')).toBeTruthy();
  });
});
