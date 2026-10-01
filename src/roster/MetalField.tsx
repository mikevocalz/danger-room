import React, { useMemo } from 'react';
import {
  Blur,
  Group,
  Path,
  Shader,
  useClock,
} from '@shopify/react-native-skia';
// skia 2.x delegates animation values to Reanimated; useDerivedValue lives there now.
import { useDerivedValue } from 'react-native-reanimated';

import { makeCircledX, type GlyphSpec } from './glyphs';
import { plateMetalEffect, rgba } from './shaders';
import { metal, type MetalName } from './tokens';

const STOPS: Record<MetalName, { lo: number[]; hi: number[] }> = {
  silver: { lo: rgba(metal.silver.lo), hi: rgba(metal.silver.hi) },
  gold: { lo: rgba(metal.gold.lo), hi: rgba(metal.gold.hi) },
};

export interface MetalFieldProps {
  finish: MetalName;
  /** Region the metal is evaluated across, in Canvas coordinates. */
  rect: { x: number; y: number; width: number; height: number };
  /** Drift the sheen. Leave off for static plates so Skia can cache the tile. */
  animated?: boolean;
}

/**
 * The plate material as a paint. Drop inside any `Path` or `Rect` to fill it
 * with brushed metal:
 *
 *   <Path path={body}><MetalField finish="gold" rect={bounds} /></Path>
 */
export const MetalField = ({
  finish,
  rect,
  animated = false,
}: MetalFieldProps) => {
  const clock = useClock();
  const stops = STOPS[finish];

  const uniforms = useDerivedValue(() => ({
    uRect: [rect.x, rect.y, rect.width, rect.height],
    uLo: stops.lo,
    uHi: stops.hi,
    uTime: animated ? clock.value / 1000 : 0,
    uSheen: animated ? 1 : 0,
  }));

  return <Shader source={plateMetalEffect} uniforms={uniforms} />;
};

export interface EmbossedMarkProps {
  finish: MetalName;
  /** Region to centre the mark in. */
  rect: { x: number; y: number; width: number; height: number };
  glyph?: GlyphSpec;
  /** Fraction of the region's short edge the mark occupies. */
  fit?: number;
  /** Positive raises the mark out of the plate; negative stamps it in. */
  depth?: number;
  /** Offset in plate pixels. */
  relief?: number;
}

const defaultGlyph = makeCircledX();

/**
 * The mark worked into the plate face rather than printed on it — same metal,
 * displaced. Two offset copies (shadow away from the light, highlight toward
 * it) plus a faint tint at rest; nothing that reads as a separate colour.
 *
 * `depth` sign flips raised ↔ stamped. The reference plates read raised.
 */
export const EmbossedMark = ({
  finish,
  rect,
  glyph = defaultGlyph,
  fit = 0.62,
  depth = 1,
  relief = 1.6,
}: EmbossedMarkProps) => {
  const tone = metal[finish];

  const { scale, dx, dy, box } = useMemo(() => {
    const b = Math.min(rect.width, rect.height) * fit;
    return {
      box: b,
      scale: b / 100,
      dx: rect.x + (rect.width - b) / 2,
      dy: rect.y + (rect.height - b) / 2,
    };
  }, [rect.x, rect.y, rect.width, rect.height, fit]);

  if (box <= 0) return null;

  const d = Math.sign(depth) || 1;
  const lit = -relief * d;
  const shade = relief * d;

  return (
    <Group transform={[{ translateX: dx }, { translateY: dy }, { scale }]}>
      {/* Shadow flank. */}
      <Group transform={[{ translateX: shade }, { translateY: shade }]}>
        <Path path={glyph.path} style="fill" color={tone.stampLo} opacity={0.55}>
          <Blur blur={0.8} />
        </Path>
      </Group>

      {/* Lit flank. */}
      <Group transform={[{ translateX: lit }, { translateY: lit }]}>
        <Path path={glyph.path} style="fill" color={tone.stampHi} opacity={0.6}>
          <Blur blur={0.8} />
        </Path>
      </Group>

      {/* Face — barely there, just enough to separate it from the field. */}
      <Path path={glyph.path} style="fill" color={tone.lo} opacity={0.18} />
    </Group>
  );
};
