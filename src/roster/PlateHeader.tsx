import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import {
  Group,
  Line,
  Rect,
  Text,
  matchFont,
  vec,
  type SkFont,
} from '@shopify/react-native-skia';

import { metal, plateHeader, type MetalName } from './tokens';

export interface PlateHeaderProps {
  width: number;
  finish: MetalName;
  /** Left-aligned label. Omitted on vacant plates. */
  label?: string;
  /** Lights the last square green; red when muted. */
  live?: boolean;
  muted?: boolean;
  font?: SkFont;
}

const headerFont = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
  fontSize: 9,
  fontStyle: 'normal',
  fontWeight: 'bold',
});

/**
 * The strip every plate carries: name at the left, a row of status squares at
 * the right with the last one lighting up. Drawn in the plate's own metal, so
 * it reads as machined into the face rather than laid over it.
 */
export const PlateHeader = ({
  width,
  finish,
  label,
  live = false,
  muted = false,
  font,
}: PlateHeaderProps) => {
  const tone = metal[finish];
  const { height, pipCount, pipSize, pipGap, inset } = plateHeader;

  const pips = useMemo(
    () =>
      Array.from({ length: pipCount }, (_, i) => ({
        key: i,
        // Index 0 is the rightmost square — the state light.
        x: width - inset - (i + 1) * pipSize - i * pipGap,
        state: i === 0,
      })),
    [width],
  );

  const y = (height - pipSize) / 2;
  void live; // live-state colour folded into the coloured traffic-lights below

  return (
    <Group>
      {label ? (
        <Text
          x={inset + 1}
          y={height / 2 + 3.5}
          text={label.toUpperCase()}
          font={font ?? headerFont}
          color={tone.ink}
        />
      ) : null}

      {pips.map(p => {
        // Old-Windows title bar: index 0 is rightmost = close, then maximize,
        // then minimize — so left→right reads minimize / maximize / close.
        // Coloured traffic-lights: min=red, max=yellow, close=green (L→R).
        const BTN = ['#3fbf46', '#f2c018', '#e6482e']; // key 0 close, 1 max, 2 min
        const pad = 2.6;
        const x0 = p.x + pad;
        const x1 = p.x + pipSize - pad;
        const y0 = y + pad;
        const y1 = y + pipSize - pad;
        const glyph = '#182231'; // dark glyph on the coloured button
        const sw = 1.1;
        return (
          <Group key={p.key}>
            <Rect
              x={p.x}
              y={y}
              width={pipSize}
              height={pipSize}
              color={muted && p.state ? plateHeader.pipMuted : BTN[p.key] ?? plateHeader.pipIdle}
            />
            {p.key === 0 ? (
              // close — ✕
              <Group>
                <Line p1={vec(x0, y0)} p2={vec(x1, y1)} color={glyph} strokeWidth={sw} />
                <Line p1={vec(x1, y0)} p2={vec(x0, y1)} color={glyph} strokeWidth={sw} />
              </Group>
            ) : p.key === 1 ? (
              // maximize — ▢
              <Rect
                x={x0}
                y={y0}
                width={pipSize - pad * 2}
                height={pipSize - pad * 2}
                style="stroke"
                strokeWidth={sw}
                color={glyph}
              />
            ) : (
              // minimize — ▁
              <Line p1={vec(x0, y1)} p2={vec(x1, y1)} color={glyph} strokeWidth={sw} />
            )}
          </Group>
        );
      })}
    </Group>
  );
};
