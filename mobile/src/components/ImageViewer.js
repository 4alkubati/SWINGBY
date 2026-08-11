// ImageViewer — full-screen, swipeable photo viewer.
//
// Reusable lightbox for any set of remote images (job photos on the quote
// flow, before/after booking photos, dispute photos…). Tap a thumbnail to
// open here at full size; swipe horizontally between photos; tap the image
// or the close button to dismiss.
//
// Props:
//   visible       boolean
//   images        string[]  — array of image URIs
//   initialIndex  number    — which photo to open on (default 0)
//   onClose       () => void
//   reportIds     (string|null)[] — F028, optional. Parallel to `images`: the
//                 reportable-content id behind each photo (e.g. a
//                 booking_photos.id), or null/undefined where the photo has
//                 no individually-reportable row (a client's own job-post
//                 photo is a URL on service_posts.image_urls, not a row of
//                 its own — report the POST for those, not the photo). Only
//                 rendered when both this AND `onReport` are supplied, and
//                 only for the currently-open photo, mirroring the icon-
//                 button pattern ReviewCard already uses.
//   onReport      (id: string) => void
import React, { useRef, useState, useEffect } from 'react';
import {
  Modal,
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import SwImage from './SwImage';
import Text from './Text';
import i18n from '../i18n';

export default function ImageViewer({
  visible, images = [], initialIndex = 0, onClose, reportIds, onReport,
}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const [width, setWidth] = useState(Dimensions.get('window').width);
  const [index, setIndex] = useState(initialIndex);

  const photos = Array.isArray(images) ? images.filter(Boolean) : [];
  const count = photos.length;

  // Jump to the tapped photo whenever the viewer (re)opens.
  useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [visible, initialIndex]);

  function handleLayout(e) {
    setWidth(e.nativeEvent.layout.width);
  }

  // Once we know the page width, position the ScrollView on the opened photo.
  function handleContentSizeChange() {
    if (scrollRef.current && index > 0) {
      scrollRef.current.scrollTo({ x: index * width, animated: false });
    }
  }

  function handleScroll(e) {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  }

  if (!count) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View style={styles.backdrop} onLayout={handleLayout}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          onContentSizeChange={handleContentSizeChange}
          scrollEventThrottle={16}
        >
          {photos.map((uri, i) => (
            <TouchableOpacity
              key={uri || i}
              activeOpacity={1}
              onPress={onClose}
              style={{ width, height: '100%' }}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('imageViewer.close')}
            >
              <SwImage
                source={{ uri }}
                style={{ width, height: '100%' }}
                contentFit="contain"
                accessibilityLabel={i18n.t('jobCard.photoAlt', { index: i + 1, count })}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Close button */}
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 8 }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('imageViewer.close')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="x" size={24} color="#fff" />
        </TouchableOpacity>

        {/* F028 — report the currently-open photo, when it has a reportable
            id behind it. */}
        {onReport && reportIds?.[index] ? (
          <TouchableOpacity
            style={[styles.reportBtn, { top: insets.top + 8 }]}
            onPress={() => onReport(reportIds[index])}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('moderation.reportPhoto')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="flag" size={20} color="#fff" />
          </TouchableOpacity>
        ) : null}

        {/* Page counter (only when there's more than one photo) */}
        {count > 1 && (
          <View style={[styles.counter, { bottom: insets.bottom + 16 }]}>
            <Text style={styles.counterText}>{`${index + 1} / ${count}`}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  counterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
