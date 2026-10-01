import React, { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';

import {
  foldLayoutsFromRegions,
  foldsIntersectingRect,
  physicalRegionsForAxis,
  type AxisRegion,
} from '@/adaptive/foldLayout';
import { useReservedRegions } from '@/adaptive/reservedRegions';

export interface RoomLayoutProps {
  host: ReactNode;
  showcase: ReactNode;
  guests: (columns: number) => ReactNode;
  hostRatio?: number;
}

interface MeasuredBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EMPTY_BOUNDS: MeasuredBounds = { x: 0, y: 0, width: 0, height: 0 };
const INNER_GAP = 12;

function sameBounds(a: MeasuredBounds, b: MeasuredBounds) {
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

export const RoomLayout = ({
  host,
  showcase,
  guests,
  hostRatio: requestedHostRatio,
}: RoomLayoutProps) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const portrait = windowHeight >= windowWidth;
  const regions = useReservedRegions();
  const rootRef = useRef<React.ElementRef<typeof View>>(null);
  const [bounds, setBounds] = useState<MeasuredBounds>(EMPTY_BOUNDS);

  const measure = useCallback(() => {
    rootRef.current?.measureInWindow((x, y, width, height) => {
      const next = { x, y, width, height };
      setBounds((previous) => (sameBounds(previous, next) ? previous : next));
    });
  }, []);

  const onLayout = useCallback((_event: LayoutChangeEvent) => {
    requestAnimationFrame(measure);
  }, [measure]);

  useEffect(() => {
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [measure, windowWidth, windowHeight, regions]);

  const folds = useMemo(() => {
    if (bounds.width <= 0 || bounds.height <= 0) return [];
    const local = foldLayoutsFromRegions(regions, { x: bounds.x, y: bounds.y });
    return foldsIntersectingRect(local, bounds.width, bounds.height);
  }, [bounds, regions]);

  const vertical = useMemo(
    () => physicalRegionsForAxis(folds, bounds.width, 'vertical'),
    [folds, bounds.width],
  );
  const horizontal = useMemo(
    () => physicalRegionsForAxis(folds, bounds.height, 'horizontal'),
    [folds, bounds.height],
  );

  return (
    <View ref={rootRef} collapsable={false} onLayout={onLayout} style={styles.fill}>
      {vertical.length >= 2 ? (
        <VerticalPhysicalLayout regions={vertical} host={host} showcase={showcase} guests={guests} />
      ) : horizontal.length >= 2 ? (
        <HorizontalPhysicalLayout regions={horizontal} host={host} showcase={showcase} guests={guests} />
      ) : portrait ? (
        <View style={styles.fill}>
          <View style={[styles.half, styles.row]}>
            <View style={{ flex: requestedHostRatio ?? 0.6 }}>{host}</View>
            <View style={{ flex: 1 - (requestedHostRatio ?? 0.6) }}>{showcase}</View>
          </View>
          <View style={styles.half}>{guests(4)}</View>
        </View>
      ) : (
        <View style={[styles.fill, styles.row]}>
          <View style={styles.half}>
            <View style={{ flex: requestedHostRatio ?? 0.5 }}>{host}</View>
            <View style={{ flex: 1 - (requestedHostRatio ?? 0.5) }}>{showcase}</View>
          </View>
          <View style={styles.half}>{guests(2)}</View>
        </View>
      )}
    </View>
  );
};

function paneStyleVertical(region: AxisRegion) {
  return { left: region.start, width: region.size, top: 0, bottom: 0 } as const;
}
function paneStyleHorizontal(region: AxisRegion) {
  return { top: region.start, height: region.size, left: 0, right: 0 } as const;
}

function VerticalPhysicalLayout({
  regions, host, showcase, guests,
}: {
  regions: AxisRegion[];
  host: ReactNode;
  showcase: ReactNode;
  guests: (columns: number) => ReactNode;
}) {
  const first = regions[0];
  const last = regions[regions.length - 1];
  if (regions.length >= 3) {
    const middle = regions[Math.floor((regions.length - 1) / 2)];
    return (
      <>
        <View style={[styles.physicalPane, paneStyleVertical(first)]}>{host}</View>
        <View style={[styles.physicalPane, paneStyleVertical(middle)]}>{showcase}</View>
        <View style={[styles.physicalPane, paneStyleVertical(last)]}>{guests(2)}</View>
      </>
    );
  }
  return (
    <>
      <View style={[styles.physicalPane, paneStyleVertical(first)]}>
        <View style={styles.fill}>
          <View style={styles.half}>{host}</View>
          <View style={styles.half}>{showcase}</View>
        </View>
      </View>
      <View style={[styles.physicalPane, paneStyleVertical(last)]}>{guests(2)}</View>
    </>
  );
}

function HorizontalPhysicalLayout({
  regions, host, showcase, guests,
}: {
  regions: AxisRegion[];
  host: ReactNode;
  showcase: ReactNode;
  guests: (columns: number) => ReactNode;
}) {
  const first = regions[0];
  const last = regions[regions.length - 1];
  if (regions.length >= 3) {
    const middle = regions[Math.floor((regions.length - 1) / 2)];
    return (
      <>
        <View style={[styles.physicalPane, paneStyleHorizontal(first)]}>{host}</View>
        <View style={[styles.physicalPane, paneStyleHorizontal(middle)]}>{showcase}</View>
        <View style={[styles.physicalPane, paneStyleHorizontal(last)]}>{guests(4)}</View>
      </>
    );
  }
  return (
    <>
      <View style={[styles.physicalPane, paneStyleHorizontal(first)]}>
        <View style={[styles.fill, styles.row]}>
          <View style={{ flex: 0.6 }}>{host}</View>
          <View style={{ flex: 0.4 }}>{showcase}</View>
        </View>
      </View>
      <View style={[styles.physicalPane, paneStyleHorizontal(last)]}>{guests(4)}</View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, gap: INNER_GAP },
  row: { flexDirection: 'row' },
  half: { flex: 1, gap: INNER_GAP },
  physicalPane: { position: 'absolute', gap: INNER_GAP },
});
