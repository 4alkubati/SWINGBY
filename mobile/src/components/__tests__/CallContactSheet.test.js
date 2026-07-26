// Kira's ruling (2026-07-25): tapping Call must SHOW the number so it can be
// copied, not fire `tel:` blind. These pin the parts that make that true.
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import CallContactSheet, { formatPhone } from '../CallContactSheet';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('../../services/toast', () => ({ show: jest.fn() }));
jest.mock('../../services/haptics', () => ({ buttonTap: jest.fn() }));

const EMPLOYEE = { key: 'employee', name: 'Marcus Lee', role: 'Cleaner', phone: '4035550142' };
const BUSINESS = { key: 'business', name: 'Test Cleaning Co.', role: 'Business', phone: '5875551234' };

describe('formatPhone', () => {
  it('renders a 10-digit NA number readably', () => {
    expect(formatPhone('4035550142')).toBe('(403) 555-0142');
  });

  it('handles a leading country code', () => {
    expect(formatPhone('14035550142')).toBe('+1 (403) 555-0142');
  });

  it('passes anything it does not recognise through untouched', () => {
    // Better to show an odd number verbatim than to mangle it — the whole point
    // is that the human can read and copy it.
    expect(formatPhone('+44 20 7946 0958')).toBe('+44 20 7946 0958');
    expect(formatPhone('')).toBe('');
  });
});

describe('CallContactSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('SHOWS the number rather than only offering to dial it', () => {
    const { queryByText } = render(
      <CallContactSheet visible contacts={[EMPLOYEE]} onClose={() => {}} />,
    );
    expect(queryByText('(403) 555-0142')).not.toBeNull();
  });

  it('offers both the assigned employee and the business when both are reachable', () => {
    const { queryByText } = render(
      <CallContactSheet visible contacts={[EMPLOYEE, BUSINESS]} onClose={() => {}} />,
    );
    expect(queryByText('Marcus Lee')).not.toBeNull();
    expect(queryByText('Test Cleaning Co.')).not.toBeNull();
    expect(queryByText('(587) 555-1234')).not.toBeNull();
  });

  it('copies the raw number to the clipboard', async () => {
    const { getByLabelText } = render(
      <CallContactSheet visible contacts={[EMPLOYEE]} onClose={() => {}} />,
    );
    fireEvent.press(getByLabelText("Copy Marcus Lee's number"));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('4035550142'));
  });

  it('strips punctuation before handing the number to the dialer', () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { getByLabelText } = render(
      <CallContactSheet
        visible
        contacts={[{ ...EMPLOYEE, phone: '(403) 555-0142' }]}
        onClose={() => {}}
      />,
    );
    fireEvent.press(getByLabelText('Call Marcus Lee'));
    expect(spy).toHaveBeenCalledWith('tel:4035550142');
    spy.mockRestore();
  });

  it('drops parties that have no number instead of showing an empty row', () => {
    const { queryByText } = render(
      <CallContactSheet
        visible
        contacts={[EMPLOYEE, { ...BUSINESS, phone: null }]}
        onClose={() => {}}
      />,
    );
    expect(queryByText('Marcus Lee')).not.toBeNull();
    expect(queryByText('Test Cleaning Co.')).toBeNull();
  });

  it('offers messaging when nobody has a number — never a dead end', () => {
    const onMessage = jest.fn();
    const { getByLabelText, queryByText } = render(
      <CallContactSheet visible contacts={[]} onClose={() => {}} onMessage={onMessage} />,
    );
    expect(queryByText(/No phone number on file/)).not.toBeNull();
    fireEvent.press(getByLabelText('Message the provider'));
    expect(onMessage).toHaveBeenCalled();
  });
});
