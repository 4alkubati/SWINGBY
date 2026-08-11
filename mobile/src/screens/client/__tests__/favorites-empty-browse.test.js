// F099 — the empty-state "Browse" button called navigation.navigate('Home').
// FavoritesScreen sits on ClientNavigator's root Stack, not inside the
// ClientTabs navigator that owns the 'Home' screen name — navigate('Home')
// from a sibling Stack screen doesn't bubble into a Tab navigator nested
// under a DIFFERENT screen, so the tap silently did nothing. The fix routes
// through the Tab navigator by name, same pattern PostJobScreen and
// RequestSentScreen already use to land back on Home.
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderScreen } from '../../../test-utils/renderWithProviders';

jest.mock('../../../services/api');
import { api } from '../../../services/api';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

import FavoritesScreen from '../FavoritesScreen';

describe('Favorites empty state', () => {
  it('routes Browse into ClientTabs/Home, not a bare "Home" the Stack never registers', async () => {
    const navigate = jest.fn();
    const { findByText } = renderScreen(
      <FavoritesScreen navigation={{ navigate, goBack: jest.fn() }} />,
    );

    const browse = await findByText('Browse');
    fireEvent.press(browse);

    expect(navigate).toHaveBeenCalledWith('ClientTabs', { screen: 'Home' });
    expect(navigate).not.toHaveBeenCalledWith('Home');
  });
});
