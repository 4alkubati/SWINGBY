// The Guideline 1.2(b) flag mechanism.
//
// The cases below are the ones a reviewer actually exercises: pick a reason,
// submit, get told it worked. Plus the two that are easy to get wrong — a
// duplicate report is not an error, and the sheet must not carry a previous
// target's selection into a new one.
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// gesture-handler v3 makes GestureDetector THROW when it is not under a
// GestureHandlerRootView; v2 only warned. App.js has always wrapped the real
// tree (App.js:176), so tests rendering a sheet in isolation were the only
// thing relying on the old leniency. Wrapping here mirrors production rather
// than mocking the requirement away.
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../theme/ThemeProvider';
import ReportSheet from '../ReportSheet';
import i18n from '../../i18n';

jest.mock('../../services/api');
import { api } from '../../services/api';

function renderSheet(props = {}) {
  return render(
    <GestureHandlerRootView>
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider>
        <ReportSheet
          visible
          onClose={jest.fn()}
          targetType="message"
          targetId="msg-1"
          {...props}
        />
      </ThemeProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ReportSheet', () => {
  it('offers every reason the backend accepts', () => {
    const { getByText } = renderSheet();
    // If these two lists drift, the sheet either offers a reason that 400s or
    // hides one the product promised.
    [
      'moderation.reasonHarassment',
      'moderation.reasonHateSpeech',
      'moderation.reasonSexualContent',
      'moderation.reasonViolence',
      'moderation.reasonScam',
      'moderation.reasonOffPlatform',
      'moderation.reasonSpam',
      'moderation.reasonOther',
    ].forEach((key) => {
      expect(getByText(i18n.t(key))).toBeTruthy();
    });
  });

  it('posts the target and reason, then confirms', async () => {
    api.post.mockResolvedValue({ data: { id: 'rep-1' } });

    const { getByText } = renderSheet();
    fireEvent.press(getByText(i18n.t('moderation.reasonHarassment')));
    await act(async () => {
      fireEvent.press(getByText(i18n.t('moderation.submitReport')));
    });

    expect(api.post).toHaveBeenCalledWith(
      '/moderation/reports',
      expect.objectContaining({
        target_type: 'message',
        target_id: 'msg-1',
        reason: 'harassment',
      }),
    );
    await waitFor(() => {
      expect(getByText(i18n.t('moderation.reportSent'))).toBeTruthy();
    });
  });

  it('treats a duplicate (409) as already-reported, not an error', async () => {
    // The user's intent is satisfied — the report is in the queue. Showing a
    // failure here would push them to report it again.
    api.post.mockRejectedValue({ response: { status: 409 } });

    const { getByText } = renderSheet();
    fireEvent.press(getByText(i18n.t('moderation.reasonSpam')));
    await act(async () => {
      fireEvent.press(getByText(i18n.t('moderation.submitReport')));
    });

    await waitFor(() => {
      expect(getByText(i18n.t('moderation.alreadyReported'))).toBeTruthy();
    });
  });

  it('surfaces a real failure without closing', async () => {
    api.post.mockRejectedValue({ response: { status: 500 } });

    const { getByText } = renderSheet();
    fireEvent.press(getByText(i18n.t('moderation.reasonOther')));
    await act(async () => {
      fireEvent.press(getByText(i18n.t('moderation.submitReport')));
    });

    await waitFor(() => {
      expect(getByText(i18n.t('moderation.reportFailed'))).toBeTruthy();
    });
  });

  it('does not send anything until a reason is picked', async () => {
    const { getByText } = renderSheet();
    await act(async () => {
      fireEvent.press(getByText(i18n.t('moderation.submitReport')));
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('clears the previous target selection when reopened', async () => {
    api.post.mockResolvedValue({ data: { id: 'rep-1' } });

    const { getByText, rerender } = renderSheet();
    fireEvent.press(getByText(i18n.t('moderation.reasonViolence')));

    // Close and reopen on a DIFFERENT message. A retained selection here means
    // the user files a report they never chose.
    const wrap = (visible, targetId) => (
      <GestureHandlerRootView>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}
      >
        <ThemeProvider>
          <ReportSheet
            visible={visible}
            onClose={jest.fn()}
            targetType="message"
            targetId={targetId}
          />
        </ThemeProvider>
      </SafeAreaProvider>
      </GestureHandlerRootView>
    );
    await act(async () => {
      rerender(wrap(false, 'msg-1'));
    });
    await act(async () => {
      rerender(wrap(true, 'msg-2'));
    });

    await act(async () => {
      fireEvent.press(getByText(i18n.t('moderation.submitReport')));
    });
    expect(api.post).not.toHaveBeenCalled();
  });
});
