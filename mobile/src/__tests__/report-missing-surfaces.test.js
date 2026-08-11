// F028 — the app carries user-generated content on six surfaces (chat, voice
// notes, reviews, job posts, proof-of-work photos, avatars) per
// backend/app/api/moderation.py's own docstring, but ReportSheet was only
// ever opened from two of them (ChatScreen, BusinessProfileScreen). This pins
// the three new entry points: job-post cards (JobOpportunityCard, the only
// surface a business ever sees a client's post in detail), proof-of-work
// photos (ImageViewer's optional reportIds/onReport), and the voice-note
// player (ApproveWorkScreen's VoiceNotePlayer).
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import JobOpportunityCard from '../components/JobOpportunityCard';
import ImageViewer from '../components/ImageViewer';
import { REPORT_TARGETS } from '../services/moderation';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const wrap = (ui) => (
  <SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>
);

const POST = {
  id: 'post-1',
  title: 'Deep clean before move-out',
  category: 'cleaning',
  budget: 150,
};

describe('F028 — JobOpportunityCard report affordance', () => {
  it('renders no report control when onReport is omitted', () => {
    const { queryByLabelText } = render(wrap(
      <JobOpportunityCard post={POST} onSendQuote={() => {}} />
    ));
    expect(queryByLabelText('Report this post')).toBeNull();
  });

  it('reports the post with REPORT_TARGETS.SERVICE_POST when tapped (full card)', () => {
    const onReport = jest.fn();
    const { getByLabelText } = render(wrap(
      <JobOpportunityCard post={POST} onSendQuote={() => {}} onReport={onReport} />
    ));
    fireEvent.press(getByLabelText('Report this post'));
    expect(onReport).toHaveBeenCalledWith(POST);
  });

  it('also offers the report control on the compact card', () => {
    const onReport = jest.fn();
    const { getByLabelText } = render(wrap(
      <JobOpportunityCard post={POST} onSendQuote={() => {}} onReport={onReport} compact />
    ));
    fireEvent.press(getByLabelText('Report this post'));
    expect(onReport).toHaveBeenCalledWith(POST);
  });
});

describe('F028 — ImageViewer per-photo report affordance', () => {
  const IMAGES = ['https://x/a.jpg', 'https://x/b.jpg'];

  it('shows no report icon when reportIds/onReport are not supplied', () => {
    const { queryByLabelText } = render(wrap(
      <ImageViewer visible images={IMAGES} onClose={() => {}} />
    ));
    expect(queryByLabelText('Report this photo')).toBeNull();
  });

  it('shows no report icon for a photo with no reportable id (e.g. a client\'s own post photo)', () => {
    const onReport = jest.fn();
    const { queryByLabelText } = render(wrap(
      <ImageViewer
        visible
        images={IMAGES}
        reportIds={[null, 'bp-2']}
        onReport={onReport}
        onClose={() => {}}
      />
    ));
    // initialIndex defaults to 0, whose id is null.
    expect(queryByLabelText('Report this photo')).toBeNull();
  });

  it('reports the currently-open photo\'s id when it has one', () => {
    const onReport = jest.fn();
    const { getByLabelText } = render(wrap(
      <ImageViewer
        visible
        images={IMAGES}
        initialIndex={1}
        reportIds={[null, 'bp-2']}
        onReport={onReport}
        onClose={() => {}}
      />
    ));
    fireEvent.press(getByLabelText('Report this photo'));
    expect(onReport).toHaveBeenCalledWith('bp-2');
  });
});

describe('F028 — REPORT_TARGETS covers the surfaces this fix wires', () => {
  it('still defines SERVICE_POST, BOOKING_PHOTO and VOICE_NOTE', () => {
    expect(REPORT_TARGETS.SERVICE_POST).toBe('service_post');
    expect(REPORT_TARGETS.BOOKING_PHOTO).toBe('booking_photo');
    expect(REPORT_TARGETS.VOICE_NOTE).toBe('voice_note');
  });
});

// ApproveWorkScreen mounts `useAudioPlayer`/`useAudioPlayerStatus` for the
// voice-note player, which isn't worth mocking just to pin this wiring —
// source-inspection (like no-purchase-linkout.test.js elsewhere in this
// suite) proves the same thing without the native-module risk.
describe('F028 — ApproveWorkScreen wires BOOKING_PHOTO and VOICE_NOTE reports', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../screens/client/ApproveWorkScreen.js'),
    'utf8',
  );

  it('reports voice notes with REPORT_TARGETS.VOICE_NOTE and a real note id', () => {
    expect(src).toMatch(/onReport=\{\(id\) => setReportTarget\(\{\s*targetType: moderation\.REPORT_TARGETS\.VOICE_NOTE/);
  });

  it('reports proof photos with REPORT_TARGETS.BOOKING_PHOTO via ImageViewer', () => {
    expect(src).toMatch(/onReport=\{\(id\) => setReportTarget\(\{\s*targetType: moderation\.REPORT_TARGETS\.BOOKING_PHOTO/);
  });

  it('never assigns a client\'s own job-post photo a reportable id', () => {
    // client_photos are bare service_posts.image_urls strings, not a
    // booking_photos row — the pairing must hard-code null for them rather
    // than inventing an id that would 400 (or worse, silently point a
    // report at the wrong row).
    expect(src).toMatch(/\(proof\?\.client_photos \|\| \[\]\)\.map\(\(url\) => \(\{ url, id: null \}\)\)/);
  });

  it('keeps beforePhotos/beforePhotoIds/afterPhotos/afterPhotoIds index-aligned', () => {
    // Built from one filtered array of {url, id} pairs, not two independently
    // .filter(Boolean)'d arrays — see the F028 comment in the source for why
    // that would have let a dropped falsy URL desync the two arrays.
    expect(src).toMatch(/beforePairs\.map\(\(p\) => p\.url\)/);
    expect(src).toMatch(/beforePairs\.map\(\(p\) => p\.id\)/);
    expect(src).toMatch(/afterPairs\.map\(\(p\) => p\.url\)/);
    expect(src).toMatch(/afterPairs\.map\(\(p\) => p\.id\)/);
  });
});
