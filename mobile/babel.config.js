module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-reanimated/plugin MUST be the LAST plugin in this array.
      // Reanimated worklets are compiled by Babel — without this, every
      // import of 'react-native-reanimated' breaks at metro bundle time.
      'react-native-reanimated/plugin',
    ],
  };
};
