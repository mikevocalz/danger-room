import React, { useMemo, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import {
  Blur,
  Canvas,
  Group,
  Path,
  RoundedRect,
  Skia,
  Text,
  matchFont,
  rect,
  rrect,
  type SkFont,
} from '@shopify/react-native-skia';

import { Bevel } from './Bevel';
import type { GlyphSpec } from './glyphs';
import { EmbossedMark, MetalField } from './MetalField';
import { NamePlate } from './NamePlate';
import { PlateHeader } from './PlateHeader';
import {
  cutout,
  metal,
  namePlateRect,
  palette,
  plate,
  plateHeader,
  type MetalName,
} from './tokens';

/**
 * A seat is unclaimed, mid-connect, or held by a peer. Deliberately separate
 * from whether that peer has video — someone with their camera off still holds
 * the seat, and the room must not read it as open.
 */
export type SeatState = 'empty' | 'joining' | 'occupied';

const nameFallback = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
  fontSize: 11,
  fontStyle: 'normal',
  fontWeight: 'bold',
});

export interface RosterTileProps {
  width: number;
  height: number;
  state?: SeatState;
  /** 1-based seat number, shown while the seat is unclaimed. */
  seatIndex?: number;
  name?: string;
  /**
   * The Fishjam video renderer for this peer. Rendered *underneath* the Skia
   * chrome and clipped to the well. Omit when the peer's camera is off.
   */
  videoSlot?: ReactNode;
  /** 0..1 audio level. */
  level?: number;
  speaking?: boolean;
  isSelf?: boolean;
  muted?: boolean;
  glyph?: GlyphSpec;
  font?: SkFont;
  /** Fired only while the seat is unclaimed. */
  onPress?: () => void;
}

/**
 * Skia cannot sample a live video track, so the plate is chrome drawn *around*
 * a native view. The chassis is one even-odd path with the well punched out;
 * the video sits in that hole at the same coordinates, both from `cutout()`.
 *
 * The seat's whole state language is its finish: silver at rest with the mark
 * stamped into the face, gold the moment someone claims it. Vacant plates run
 * a static shader, so eight empty seats cost nothing per frame.
 */
export const RosterTile = ({
  width,
  height,
  state = 'empty',
  seatIndex,
  name,
  videoSlot,
  level = 0,
  speaking = false,
  isSelf = false,
  muted = false,
  glyph,
  font,
  onPress,
}: RosterTileProps) => {
  const hole = useMemo(() => cutout(width, height), [width, height]);
  const nameRect = useMemo(() => namePlateRect(width, height), [width, height]);
  const bounds = useMemo(
    () => ({ x: 0, y: 0, width, height }),
    [width, height],
  );

  const holeEdge = useMemo(() => {
    const p = Skia.Path.Make();
    p.addRRect(
      rrect(
        rect(hole.x, hole.y, hole.width, hole.height),
        plate.innerRadius,
        plate.innerRadius,
      ),
    );
    return p;
  }, [hole.x, hole.y, hole.width, hole.height]);

  const videoStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: hole.x,
      top: hole.y,
      width: hole.width,
      height: hole.height,
      borderRadius: plate.innerRadius,
      overflow: 'hidden' as const,
      backgroundColor: palette.void,
    }),
    [hole.x, hole.y, hole.width, hole.height],
  );

  if (width <= 0 || height <= 0) return null;

  const claimed = state === 'occupied';
  const finish: MetalName = claimed ? 'gold' : 'silver';
  const tone = metal[finish];
  const showVideo = claimed && !!videoSlot;

  // 'joining' animates the sheen — the only moving plate in a resting grid,
  // which is exactly where the eye should go.
  const animated = state === 'joining';

  const label = claimed
    ? (name ?? 'GUEST')
    : state === 'joining'
      ? 'CONNECTING'
      : seatIndex
        ? `SEAT ${String(seatIndex).padStart(2, '0')}`
        : undefined;

  // A vacant/guest seat carries its username centered along the bottom.
  const guestName = !claimed && name && name !== 'OPEN' ? name : undefined;

  const ringColor = isSelf ? palette.self : palette.live;
  const ringWidth = speaking ? 2 + Math.min(1, level) * 2 : isSelf ? 2 : 0;

  const body = (
    <View style={{ width, height }}>
      {/* Native layer. */}
      <View style={videoStyle}>{showVideo ? videoSlot : null}</View>

      {/* Chrome layer — never intercepts touches. */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Unclaimed: the well is plate metal too, with the mark worked in. */}
        {!claimed ? (
          <Group>
            <RoundedRect
              x={hole.x}
              y={hole.y}
              width={hole.width}
              height={hole.height}
              r={plate.innerRadius}
            >
              <MetalField finish={finish} rect={bounds} animated={animated} />
            </RoundedRect>
            <EmbossedMark finish={finish} rect={hole} glyph={glyph} />
          </Group>
        ) : null}

        {/* Claimed but camera off: dark well, mark still stamped, in gold. */}
        {claimed && !videoSlot ? (
          <Group>
            <RoundedRect
              x={hole.x}
              y={hole.y}
              width={hole.width}
              height={hole.height}
              r={plate.innerRadius}
              color={palette.void}
            />
            <EmbossedMark
              finish={finish}
              rect={hole}
              glyph={glyph}
              fit={0.44}
              depth={-1}
            />
          </Group>
        ) : null}

        {/* The plate itself. */}
        <Bevel
          width={width}
          height={height}
          hole={hole}
          fill={
            <MetalField finish={finish} rect={bounds} animated={animated} />
          }
          edges={tone.edges}
          innerShadow={claimed ? 0.45 : 0.25}
          rivets={false}
        />

        <PlateHeader
          width={width}
          finish={finish}
          label={label}
          live={claimed && !muted}
          muted={claimed && muted}
          font={font}
        />

        {/* Vacant/guest seat: username as a lower-third caption sitting directly
            on the plate face — no gap above it. */}
        {guestName
          ? (() => {
              // Anchored to the plate bottom (full height); the shortened well
              // above leaves the slight gap.
              const gnH = 20;
              const gnY = height - gnH - 3;
              const face = font ?? nameFallback;
              const upper = guestName.toUpperCase();
              const tw = face.measureText(upper).width;
              return (
                <Group>
                  <RoundedRect
                    x={hole.x}
                    y={gnY}
                    width={hole.width}
                    height={gnH}
                    r={plate.innerRadius}
                    color="#000000"
                    opacity={0.5}
                  />
                  <Text
                    x={hole.x + (hole.width - tw) / 2}
                    y={gnY + gnH / 2 + 4}
                    text={upper}
                    font={face}
                    color={palette.ink}
                  />
                </Group>
              );
            })()
          : null}

        {speaking ? (
          <Group>
            <Path
              path={holeEdge}
              style="stroke"
              strokeWidth={ringWidth}
              color={ringColor}
            />
            <Path
              path={holeEdge}
              style="stroke"
              strokeWidth={ringWidth * 2}
              color={ringColor}
              opacity={0.35}
            >
              <Blur blur={5} />
            </Path>
          </Group>
        ) : isSelf && claimed ? (
          <Path
            path={holeEdge}
            style="stroke"
            strokeWidth={2}
            color={palette.self}
          />
        ) : null}

        {/* Bottom name bar, per the original spec — pulse lives here. */}
        {claimed ? (
          <NamePlate
            rect={nameRect}
            name={name ?? 'GUEST'}
            level={level}
            isSelf={isSelf}
            muted={muted}
            font={font}
          />
        ) : null}
      </Canvas>
    </View>
  );

  if (state === 'empty' && onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Join ${label?.toLowerCase() ?? 'open seat'}`}
      >
        {body}
      </Pressable>
    );
  }

  return body;
};
