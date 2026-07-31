// Settings → Safety → Blocked accounts (App Store Guideline 1.2(c)).
//
// This screen is the ONLY route to unblocking: once someone is blocked, their
// threads and posts are gone from every other surface that could have carried
// the undo. So "the list loads and unblock works" is the whole requirement,
// and a reviewer looking for block management looks exactly here.
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import BlockedAccountsScreen from '../BlockedAccountsScreen';
import i18n from '../../../i18n';

jest.mock('../../../services/api');
import { api } from '../../../services/api';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  // The real useFocusEffect needs a navigation container; run the callback once.
  useFocusEffect: (cb) => require('react').useEffect(cb, []),
}));

const ROW = {
  id: 'blk-1',
  blocked_id: 'user-9',
  created_at: '2026-07-30T12:00:00Z',
  blocked: { id: 'user-9', first_name: 'Dana', last_name: 'Reed' },
};

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider>
        <BlockedAccountsScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BlockedAccounts', () => {
  it('lists who you blocked', async () => {
    api.get.mockResolvedValue({ data: { items: [ROW] } });
    const utils = renderScreen();
    await waitFor(() => expect(utils.getByText('Dana Reed')).toBeTruthy());
    expect(api.get).toHaveBeenCalledWith('/moderation/blocks');
  });

  it('says so plainly when nobody is blocked', async () => {
    api.get.mockResolvedValue({ data: { items: [] } });
    const utils = renderScreen();
    await waitFor(() =>
      expect(utils.getByText(i18n.t('moderation.blockedEmptyTitle'))).toBeTruthy(),
    );
  });

  it('unblocks after confirming, and drops the row', async () => {
    api.get.mockResolvedValue({ data: { items: [ROW] } });
    api.delete.mockResolvedValue({ data: { message: 'unblocked' } });
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const utils = renderScreen();
    await waitFor(() => expect(utils.getByText('Dana Reed')).toBeTruthy());

    fireEvent.press(utils.getByText(i18n.t('moderation.unblock')));

    // Destructive-ish and irreversible from the user's point of view, so it
    // confirms rather than firing on the first tap.
    expect(spy).toHaveBeenCalled();
    const confirm = spy.mock.calls.at(-1)[2].find((b) => b.onPress);
    await act(async () => {
      await confirm.onPress();
    });

    expect(api.delete).toHaveBeenCalledWith('/moderation/blocks/user-9');
    await waitFor(() => expect(utils.queryByText('Dana Reed')).toBeNull());
    spy.mockRestore();
  });

  it('shows the empty state rather than an error wall when the load fails', async () => {
    // The list is small and one tap away; an error page here would be more
    // alarming than the thing it is reporting.
    api.get.mockRejectedValue(new Error('offline'));
    const utils = renderScreen();
    await waitFor(() =>
      expect(utils.getByText(i18n.t('moderation.blockedEmptyTitle'))).toBeTruthy(),
    );
  });
});
