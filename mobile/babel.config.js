module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-worklets/plugin MUST be the LAST plugin in this array.
      // Reanimated 4 split worklets into a separate package — plugin name
      // changed from 'react-native-reanimated/plugin' (v3) to this one (v4).
      'react-native-worklets/plugin',
    ],
  };
};
