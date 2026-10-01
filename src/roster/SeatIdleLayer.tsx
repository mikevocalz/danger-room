import React, { useMemo } from 'react';
import {
  Group,
  Path,
  Rect,
  Shader,
  useClock,
} from '@shopify/react-native-skia';
// skia 2.x delegates animation values to Reanimated; useDerivedValue lives there now.
import { useDerivedValue } from 'react-native-reanimated';

import { makeCircledX, type GlyphSpec } from './glyphs';
import { markSweepEffect, rgba, seatVoidEffect } from './shaders';
import { palette, seat, seatGlow, seatPending } from './tokens';

export interface SeatIdleLayerProps {
  /** Cutout rect in Canvas coordinates. */
  hole: { x: number; y: number; width: number; height: number };
  /** 'empty' animates in neon; 'joining' holds the pending colour. */
  mode: 'empty' | 'joining';
  glyph?: GlyphSpec;
}

const defaultGlyph = makeCircledX();

const GLOW_A = rgba(seatGlow[0]);
const GLOW_B = rgba(seatGlow[1]);
const BASE = rgba(palette.seatVoid);
const PENDING = rgba(seatPending);

/**
 * The unclaimed seat, fully shader-lit: SkSL ambience across the void and a
 * sweep-filled mark at near-full bleed. Both effects share one clock so the
 * whole grid of open seats breathes in phase.
 */
export const SeatIdleLayer = ({
  hole,
  mode,
  glyph = defaultGlyph,
}: SeatIdleLayerProps) => {
  const clock = useClock();

  const { scale, dx, dy, box } = useMemo(() => {
    const b = Math.min(hole.width, hole.height) * seat.emptyFit;
    return {
      box: b,
      scale: b / 100,
      dx: hole.x + (hole.width - b) / 2,
      dy: hole.y + (hole.height - b) / 2,
    };
  }, [hole.x, hole.y, hole.width, hole.height]);

  const pending = mode === 'joining';

  const voidUniforms = useDerivedValue(() => ({
    uTime: clock.value / 1000,
    uRect: [hole.x, hole.y, hole.width, hole.height],
    uBase: BASE,
    uGlowA: pending ? PENDING : GLOW_A,
    uGlowB: pending ? PENDING : GLOW_B,
  }));

  // The mark is drawn inside a scaled Group, so its shader evaluates in the
  // glyph's authored 100x100 space — not Canvas coordinates.
  const sweepUniforms = useDerivedValue(() => ({
    uTime: pending ? 0 : clock.value / 1000,
    uRect: [0, 0, 100, 100],
    uGlowA: pending ? PENDING : GLOW_A,
    uGlowB: pending ? PENDING : GLOW_B,
  }));

  if (box <= 0) return null;

  return (
    <Group>
      <Rect x={hole.x} y={hole.y} width={hole.width} height={hole.height}>
        <Shader source={seatVoidEffect} uniforms={voidUniforms} />
      </Rect>

      <Group
        transform={[{ translateX: dx }, { translateY: dy }, { scale }]}
        opacity={seat.emptyOpacity + (pending ? 0.25 : 0)}
      >
        <Path path={glyph.path} style="fill">
          <Shader source={markSweepEffect} uniforms={sweepUniforms} />
        </Path>
      </Group>
    </Group>
  );
};
