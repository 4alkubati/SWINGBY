// The chat header's Report/Block control (App Store Guideline 1.2).
//
// Chat is where abuse actually arrives and the first place a reviewer looks for
// these controls, so "the overflow is on screen" is worth pinning. It replaced
// a dead 32px spacer, which means a careless layout tidy-up could delete it
// without breaking anything visible — exactly the kind of regression a test
// should catch rather than a walkthrough.
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import ChatScreen from '../ChatScreen';
import i18n from '../../../i18n';

jest.mock('../../../services/api');
import { api } from '../../../services/api';

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'client-1', role: 'client', email: 'a@b.co' } }),
}));
jest.mock('../../../context/UnreadContext', () => ({
  useUnread: () => ({ mark: jest.fn() }),
}));

const nav = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() };

function renderChat() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider>
        <ChatScreen
          navigation={nav}
          route={{ params: { bookingId: 'b-1', otherPartyName: 'Bow River' } }}
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('chat safety controls', () => {
  it('renders the safety overflow once the counterpart is known', async () => {
    api.get.mockResolvedValue({
      items: [],
      counterpart_user_id: 'owner-1',
      interest: null,
    });

    const utils = renderChat();

    await waitFor(() => {
      expect(utils.getByLabelText(i18n.t('moderation.safety'))).toBeTruthy();
    });
  });

  it('hides the overflow when there is nobody to report or block', async () => {
    // Not a cosmetic choice: Block needs a user id, and offering a control that
    // cannot do anything is worse than not offering it.
    api.get.mockResolvedValue({ items: [], interest: null });

    const utils = renderChat();

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(utils.queryByLabelText(i18n.t('moderation.safety'))).toBeNull();
  });

  it('tells the user why they cannot reply when the thread is blocked', async () => {
    api.get.mockImplementation((url) => {
      if (String(url).includes('/moderation/blocks/check/')) {
        return Promise.resolve({ blocked: true });
      }
      return Promise.resolve({
        items: [],
        counterpart_user_id: 'owner-1',
        interest: null,
      });
    });

    const utils = renderChat();

    await waitFor(() => {
      expect(
        utils.getByText(i18n.t('moderation.threadBlockedTitle')),
      ).toBeTruthy();
    });
  });
});
