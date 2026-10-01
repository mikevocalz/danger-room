module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // babel-preset-expo already injects the react-native-worklets plugin
    // (Reanimated 4). Only unplugin-typegpu needs adding, for TypeGPU codegen.
    // Clear the Metro cache after adding: `npx expo start -c`.
    plugins: ['unplugin-typegpu/babel'],
  };
};
