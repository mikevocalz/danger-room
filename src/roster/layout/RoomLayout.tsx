import React, { type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

/** Center gutter that clears the Surface Duo hinge between the two screens.
 * Hand-tuned (Expo has no fold API): too small → a pane bleeds across the hinge,
 * too large → dead space on the near screen. */
const HINGE = 28;

export interface RoomLayoutProps {
  /** The host feed panel (HostPlate). */
  host: ReactNode;
  /** The DNA showcase panel. */
  showcase: ReactNode;
  /**
   * The guest band. Receives the column count best suited to the current
   * orientation: 4 columns in portrait (4 over 4), 2 in landscape (2 x 4).
   */
  guests: (columns: number) => ReactNode;
  /** Host share of the host+showcase pairing (host and showcase split 50/50). */
  hostRatio?: number;
}

/**
 * The rotation contract:
 *
 * PORTRAIT                       LANDSCAPE
 * ┌────────────┬───────┐        ┌──────────┬────────────┐
 * │  host 60%  │ show  │  50%   │ host 60% │            │
 * ├────────────┴───────┤        ├──────────┤  guests    │
 * │      guests        │  50%   │ show 40% │  2 x 4     │
 * │      4 x 2         │        │          │            │
 * └────────────────────┘        └──────────┴────────────┘
 *
 * Landscape's left half becomes portrait's top half; the 60/40 host/showcase
 * split rides along, flipping its axis (stacked in landscape, side-by-side in
 * portrait) so the host feed always gets the wider aspect.
 */
export const RoomLayout = ({
  host,
  showcase,
  guests,
  hostRatio = 0.5,
}: RoomLayoutProps) => {
  const { width, height } = useWindowDimensions();
  const portrait = height >= width;

  // Landscape (current book posture) splits host/showcase 50/50; portrait 60/40.
  const ratio = portrait ? 0.6 : 0.5;
  const showcaseRatio = 1 - ratio;
  hostRatio = ratio;

  if (portrait) {
    return (
      <View style={styles.fill}>
        <View style={[styles.half, styles.row]}>
          <View style={{ flex: hostRatio }}>{host}</View>
          <View style={{ flex: showcaseRatio }}>{showcase}</View>
        </View>
        <View style={styles.half}>{guests(4)}</View>
      </View>
    );
  }

  return (
    // Landscape == the Surface Duo spanned across both screens: host+showcase on
    // the left panel, guests on the right. The center gutter must clear the
    // physical hinge or the right pane bleeds a few px onto the left screen.
    // ponytail: hardcoded hinge gutter — Expo exposes no fold API; swap for the
    // WindowManager fold bounds if this needs to be exact per device posture.
    <View style={[styles.fill, styles.landscapeRow]}>
      <View style={styles.half}>
        <View style={{ flex: hostRatio }}>{host}</View>
        <View style={{ flex: showcaseRatio }}>{showcase}</View>
      </View>
      <View style={styles.half}>{guests(2)}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  // gap keeps the host+showcase pairing from bleeding into the guest band
  // (portrait: vertical split; landscape: horizontal split).
  // The split between the two panes lands on the Duo hinge; the gutter must be
  // wide enough to clear it so neither pane bleeds onto the other screen.
  // Portrait (book posture, hinge horizontal): vertical gutter here.
  // ponytail: hardcoded hinge gutter — Expo exposes no fold API.
  fill: { flex: 1, gap: HINGE },
  row: { flexDirection: 'row' },
  // Landscape (hinge vertical): horizontal gutter between left/right panes.
  landscapeRow: { flexDirection: 'row', gap: HINGE },
  // Inner host/showcase pairing sits within one screen — no hinge, small gap.
  half: { flex: 1, gap: 12 },
});
