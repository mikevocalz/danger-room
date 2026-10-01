// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Bundle 3D model assets (the showcase GLBs).
config.resolver.assetExts.push('glb','gltf','bin','obj','mtl','fbx','hdr','exr','ktx','ktx2','vrx','arobject');

// react-native-wgpu: `three` does not resolve to its WebGPU build on RN by
// default. The roster imports `three/webgpu` explicitly, but transitive deps
// (e.g. GLTFLoader) import bare `three` — point those at the WebGPU build too.
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return context.resolveRequest(context, 'three/webgpu', platform);
  }
  return (upstreamResolveRequest ?? context.resolveRequest)(
    context,
    moduleName,
    platform,
  );
};

module.exports = config;
