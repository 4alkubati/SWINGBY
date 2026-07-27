// Web stub for react-native-maps.
//
// react-native-maps ships no web implementation, so `expo export --platform
// web` fails on it. That failure is the only thing standing between this repo
// and being able to run the app headlessly on the server for click-through
// testing — which is how four unreachable screens and a red-box crash reached
// a phone instead of being caught here.
//
// This stub exists ONLY for the web bundle (wired in metro.config.js behind a
// `platform === 'web'` check). iOS and Android resolve the real package
// untouched, so nothing about the shipped app changes.
//
// It renders a labelled placeholder rather than null on purpose: a blank space
// looks like a layout bug during a web walkthrough, whereas "Map (native only)"
// tells the person testing that this specific surface is out of scope here and
// must be checked on a device.
import React from 'react';
import { View, Text } from 'react-native';

function Placeholder({ style, children }) {
  return (
    <View
      style={[
        {
          backgroundColor: '#1b1b1f',
          borderWidth: 1,
          borderColor: '#2e2e35',
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 120,
        },
        style,
      ]}
    >
      <Text style={{ color: '#8a8a95', fontSize: 12 }}>Map (native only)</Text>
      {children}
    </View>
  );
}

const Noop = () => null;

export const Marker = Noop;
export const Callout = Noop;
export const Polyline = Noop;
export const Polygon = Noop;
export const Circle = Noop;
export const Overlay = Noop;
export const Heatmap = Noop;
export const Geojson = Noop;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = null;
export const MapMarker = Noop;
export const AnimatedRegion = class {
  constructor(v) { Object.assign(this, v || {}); }
  timing() { return { start: () => {} }; }
  setValue() {}
};

export default Placeholder;
