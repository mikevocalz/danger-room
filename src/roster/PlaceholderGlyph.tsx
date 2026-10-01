import React, { useMemo } from 'react';
import { Group, LinearGradient, Path, vec } from '@shopify/react-native-skia';

import { makeCircledX, type GlyphSpec } from './glyphs';
import { palette } from './tokens';

export interface PlaceholderGlyphProps {
  /** Cutout rect the glyph is centred in. */
  hole: { x: number; y: number; width: number; height: number };
  /** Defaults to the circled-X roster mark. Build others from `./glyphs`. */
  glyph?: GlyphSpec;
  /** Flat colour. Ignored when `gradient` is supplied. */
  color?: string;
  /** Two-stop neon sweep across the mark. */
  gradient?: readonly [string, string];
  /** Fraction of the cutout's short edge the mark occupies. */
  fit?: number;
  opacity?: number;
}

const defaultGlyph = makeCircledX();

export const PlaceholderGlyph = ({
  hole,
  glyph = defaultGlyph,
  color = palette.signal,
  gradient,
  fit = 0.5,
  opacity = 0.9,
}: PlaceholderGlyphProps) => {
  const { scale, dx, dy, box } = useMemo(() => {
    const b = Math.min(hole.width, hole.height) * fit;
    return {
      box: b,
      scale: b / 100,
      dx: hole.x + (hole.width - b) / 2,
      dy: hole.y + (hole.height - b) / 2,
    };
  }, [hole.x, hole.y, hole.width, hole.height, fit]);

  if (scale <= 0 || box <= 0) return null;

  const stroked = glyph.style === 'stroke';

  return (
    <Group transform={[{ translateX: dx }, { translateY: dy }, { scale }]}>
      <Path
        path={glyph.path}
        style={stroked ? 'stroke' : 'fill'}
        strokeWidth={glyph.strokeWidth ?? 4}
        strokeCap="square"
        color={gradient ? undefined : color}
        opacity={opacity}
      >
        {gradient ? (
          <LinearGradient
            start={vec(0, 0)}
            end={vec(100, 100)}
            colors={[gradient[0], gradient[1]]}
          />
        ) : null}
      </Path>
    </Group>
  );
};
