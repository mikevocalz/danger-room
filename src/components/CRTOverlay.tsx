import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Fill, Path, RadialGradient, Skia, vec } from '@shopify/react-native-skia';

/** Old-TV overlay for the host self-view: scanlines + vignette + cool tint.
 *  (The WebGPU-baked CRT that peers also see is iOS 17+; this is the local look.) */
export const CRTOverlay = ({ width, height }: { width: number; height: number }) => {
  const lines = useMemo(() => {
    const p = Skia.Path.Make();
    for (let y = 0; y < height; y += 3) {
      p.moveTo(0, y);
      p.lineTo(width, y);
    }
    return p;
  }, [width, height]);

  if (width <= 0 || height <= 0) return null;
  return (
    <Canvas style={[StyleSheet.absoluteFill]} pointerEvents="none">
      {/* Scanlines */}
      <Path path={lines} style="stroke" strokeWidth={1} color="rgba(0,0,0,0.30)" />
      {/* Cool phosphor tint */}
      <Fill color="rgba(30,60,80,0.10)" />
      {/* Vignette */}
      <Fill>
        <RadialGradient
          c={vec(width / 2, height / 2)}
          r={Math.max(width, height) * 0.72}
          colors={['#00000000', '#000000b0']}
        />
      </Fill>
    </Canvas>
  );
};
