import React, { useCallback, useMemo, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import type { SkFont } from '@shopify/react-native-skia';

import type { GlyphSpec } from './glyphs';

import { RosterTile, type SeatState } from './RosterTile';
import { grid, SEAT_ROW_GAP } from './tokens';

export interface RosterPeer {
  id: string;
  name: string;
  /** 'occupied' lights the plate gold and reveals its video; 'empty' = faceplate. */
  state?: SeatState;
  videoSlot?: ReactNode;
  level?: number;
  speaking?: boolean;
  isSelf?: boolean;
  muted?: boolean;
}

export interface RosterGridProps {
  peers: RosterPeer[];
  columns?: number;
  /**
   * When set, the grid measures its height and sizes cells to fill exactly
   * `rows` x `columns` — for fixed bands like the room's guest half. When
   * omitted, cell height comes from the aspect token and the grid grows.
   */
  rows?: number;
  /**
   * Pad out to a fixed cell count with empty plates, so the console keeps its
   * shape as people join and leave. Set to 0 to size to the peer list.
   */
  slots?: number;
  glyph?: GlyphSpec;
  font?: SkFont;
}

type Cell = { key: string; peer?: RosterPeer };

/**
 * Lays peers into a fixed-column console. Cell size is derived from measured
 * width, so tiles stay pixel-aligned instead of relying on flex rounding.
 */
export const RosterGrid = ({
  peers,
  columns = 3,
  rows,
  slots = 12,
  glyph,
  font,
}: RosterGridProps) => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  const cells = useMemo<Cell[]>(() => {
    const total = Math.max(slots, peers.length);
    return Array.from({ length: total }, (_, i) => ({
      key: peers[i]?.id ?? `empty-${i}`,
      peer: peers[i],
    }));
  }, [peers, slots]);

  const { cellWidth, cellHeight } = useMemo(() => {
    if (size.width <= 0) return { cellWidth: 0, cellHeight: 0 };
    const w = (size.width - grid.gap * (columns - 1)) / columns;
    if (rows && size.height > 0) {
      // D4: rows shrink by SEAT_ROW_GAP so the gap appears without the band growing.
      const h = (size.height - SEAT_ROW_GAP * (rows - 1)) / rows;
      return { cellWidth: w, cellHeight: h };
    }
    return { cellWidth: w, cellHeight: w / grid.aspect };
  }, [size.width, size.height, columns, rows]);

  return (
    <View
      onLayout={onLayout}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: grid.gap,
        rowGap: SEAT_ROW_GAP, // D4 — explicit vertical gap between the two guest rows
        ...(rows ? { flex: 1, alignContent: 'center' } : null),
      }}
    >
      {cellWidth > 0
        ? cells.map(({ key, peer }) => (
            <RosterTile
              key={key}
              width={cellWidth}
              height={cellHeight}
              name={peer?.name ?? 'OPEN'}
              state={peer?.state}
              videoSlot={peer?.videoSlot}
              level={peer?.level}
              speaking={peer?.speaking}
              isSelf={peer?.isSelf}
              muted={peer?.muted}
              glyph={glyph}
              font={font}
            />
          ))
        : null}
    </View>
  );
};
