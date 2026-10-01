import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import {
  Group,
  RoundedRect,
  Text,
  matchFont,
  type SkFont,
} from '@shopify/react-native-skia';

import { palette, plate } from './tokens';

export interface NamePlateProps {
  rect: { x: number; y: number; width: number; height: number };
  name: string;
  /** 0..1 audio level. Drives the pulse bar. */
  level?: number;
  /** Local participant — plate is keyed to the self colour. */
  isSelf?: boolean;
  muted?: boolean;
  /** Swap in a bundled face via `useFont` for production. */
  font?: SkFont;
}

const fallbackFont = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
  fontSize: 11,
  fontStyle: 'normal',
  fontWeight: 'bold',
});

/**
 * Lower-third style: left-aligned, uppercase, with the audio pulse as a bar
 * growing from the left edge rather than a bouncing meter — steadier to read
 * across twelve tiles at once.
 */
export const NamePlate = ({
  rect: r,
  name,
  level = 0,
  isSelf = false,
  muted = false,
  font,
}: NamePlateProps) => {
  const face = font ?? fallbackFont;

  const label = useMemo(() => {
    const upper = name.toUpperCase();
    const max = Math.max(3, Math.floor(r.width / 7));
    return upper.length > max ? `${upper.slice(0, max - 1)}…` : upper;
  }, [name, r.width]);

  const accent = muted ? palette.signal : isSelf ? palette.self : palette.live;
  const pulseWidth = Math.max(0, Math.min(1, level)) * r.width;

  return (
    <Group>
      <RoundedRect
        x={r.x}
        y={r.y}
        width={r.width}
        height={r.height}
        r={plate.innerRadius}
        color="#000000"
        opacity={0.55}
      />

      {/* Audio pulse — a bar along the plate's bottom edge. */}
      {pulseWidth > 0 ? (
        <RoundedRect
          x={r.x}
          y={r.y + r.height - 2}
          width={pulseWidth}
          height={2}
          r={1}
          color={accent}
        />
      ) : null}

      <Text
        x={r.x + 6}
        y={r.y + r.height / 2 + 4}
        text={label}
        font={face}
        color={palette.ink}
      />

      {/* State pip on the right. */}
      <RoundedRect
        x={r.x + r.width - 8}
        y={r.y + r.height / 2 - 2}
        width={4}
        height={4}
        r={2}
        color={accent}
        opacity={muted || isSelf || level > 0.05 ? 1 : 0.25}
      />
    </Group>
  );
};
