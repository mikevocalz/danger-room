import React, { useMemo, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  Canvas,
  Group,
  Rect,
  RoundedRect,
  Shader,
  matchFont,
  useClock,
  type SkFont,
} from '@shopify/react-native-skia';
// skia 2.x delegates animation values to Reanimated; useDerivedValue lives there now.
import { useDerivedValue } from 'react-native-reanimated';

import { Bevel } from './Bevel';
import { MetalField } from './MetalField';
import { PlateHeader } from './PlateHeader';
import { hostScreenEffect, rgba } from './shaders';
import { host, hostPlate, hostScreen, metal } from './tokens';

export interface HostPlateProps {
  width: number;
  height: number;
  name: string;
  /**
   * The host's Fishjam video renderer. Rendered *under* the chrome, filling
   * the screen rect. Omit and the purple screen shows through — that is the
   * plate's idle state, not an overlay.
   */
  videoSlot?: ReactNode;
  level?: number;
  speaking?: boolean;
  /** LIVE / REC style tag at the header's centre-right. */
  tag?: string;
  /** Animate the screen's breathe and bloom. Off when video is present. */
  animated?: boolean;
  font?: SkFont;
}

const SCREEN_HI = rgba(host.screenHi);
const SCREEN_LO = rgba(host.screenLo);
const SCREEN_BLOOM = rgba(host.screenBloom);

const headerFont = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
  fontSize: 12,
  fontStyle: 'normal',
  fontWeight: 'bold',
});

/**
 * The stage. Same native-under / Skia-over contract as a seat, but its own
 * chrome family: pale console frame, steel-blue inner line, header strip with
 * control squares, and a purple CRT screen where the video lands.
 *
 * The name lives in the header rather than a bottom bar — that is what keeps
 * the stage from reading as an oversized cell.
 */
export const HostPlate = ({
  width,
  height,
  name,
  videoSlot,
  level = 0,
  speaking = false,
  tag,
  animated = true,
  font,
}: HostPlateProps) => {
  const screen = useMemo(() => hostScreen(width, height), [width, height]);
  const clock = useClock();

  const live = animated && !videoSlot;

  const screenUniforms = useDerivedValue(() => ({
    uTime: clock.value / 1000,
    uRect: [screen.x, screen.y, screen.width, screen.height],
    uHi: SCREEN_HI,
    uLo: SCREEN_LO,
    uBloom: SCREEN_BLOOM,
    uLife: live ? 1 : 0,
  }));

  const videoStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: screen.x,
      top: screen.y,
      width: screen.width,
      height: screen.height,
      overflow: 'hidden' as const,
      backgroundColor: host.screenLo,
    }),
    [screen.x, screen.y, screen.width, screen.height],
  );

  if (width <= 0 || height <= 0) return null;

  const face = font ?? headerFont;
  // Speaking reads as a brightening of the header's steel line rather than a
  // ring — the stage is already the focal point; it doesn't need a halo.
  const edgeAlpha = speaking ? 0.55 + Math.min(1, level) * 0.45 : 0.55;

  return (
    <View style={{ width, height }}>
      {/* Native layer. */}
      <View style={videoStyle}>{videoSlot}</View>

      {/* Chrome layer. */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Idle screen — only when no feed, so we never paint over video. */}
        {!videoSlot ? (
          <Rect
            x={screen.x}
            y={screen.y}
            width={screen.width}
            height={screen.height}
          >
            <Shader source={hostScreenEffect} uniforms={screenUniforms} />
          </Rect>
        ) : null}

        {/* Console frame with the screen punched out — same silver as a
            vacant seat, so the stage reads as the room's own hardware. */}
        <Bevel
          width={width}
          height={height}
          hole={screen}
          fill={
            <MetalField
              finish="silver"
              rect={{ x: 0, y: 0, width, height }}
            />
          }
          edges={metal.silver.edges}
          radii={{ outer: hostPlate.radius, inner: hostPlate.screenRadius }}
          innerShadow={0}
          rivets={false}
        />

        {/* Steel-blue line inboard of the frame. */}
        <RoundedRect
          x={screen.x - 1.5}
          y={screen.y - 1.5}
          width={screen.width + 3}
          height={screen.height + 3}
          r={hostPlate.screenRadius}
          style="stroke"
          strokeWidth={1.5}
          color={host.edge}
          opacity={edgeAlpha}
        />

        {/* Header strip — same component the seats carry. Nudged down into the
            host's taller header band so the name isn't jammed to the top edge. */}
        <Group transform={[{ translateY: 4 }]}>
          <PlateHeader
            width={width}
            finish="silver"
            label={tag ? `${name}  ${tag}` : name}
            live={!!videoSlot}
            font={face}
          />
        </Group>

      </Canvas>
    </View>
  );
};
