import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { HostPlate } from '../HostPlate';
import { RoomLayout } from './RoomLayout';
import { RosterGrid, type RosterPeer } from '../RosterGrid';
import { DnaShowcase } from '../showcase/DnaShowcase';
import { makeCircledX } from '../glyphs';
import { palette } from '../tokens';

export interface RoomScreenProps {
  hostName: string;
  /** Fishjam video renderer for the host track. */
  hostVideo?: ReactNode;
  hostLevel?: number;
  hostSpeaking?: boolean;
  /** Up to 8 guests; the band pads the rest with open seats. */
  guests: RosterPeer[];
  /** Receives setModel for the showcase GLB once the surface is up. */
  onShowcaseReady?: (api: { setModel: (o: object) => void }) => void;
}

const mark = makeCircledX({ armSpan: 52, armWidthOuter: 16, ringGap: 9 });

/**
 * The assembled one-phone room.
 *
 * Portrait: host (60%) beside the showcase (40%) on top; 8 guest seats 4x2
 * below. Landscape: that pairing stacks into the left half; guests go 2x4 on
 * the right. HostPlate measures itself via onLayout since the layout hands it
 * a flex cell, not fixed pixels.
 */
export const RoomScreen = ({
  hostName,
  hostVideo,
  hostLevel = 0,
  hostSpeaking = false,
  guests,
  onShowcaseReady,
}: RoomScreenProps) => {
  return (
    <View style={styles.root}>
      <RoomLayout
        host={
          <MeasuredHost
            name={hostName}
            videoSlot={hostVideo}
            level={hostLevel}
            speaking={hostSpeaking}
          />
        }
        showcase={<DnaShowcase onReady={onShowcaseReady as never} />}
        guests={columns => (
          <RosterGrid
            peers={guests}
            columns={columns}
            rows={8 / columns}
            slots={8}
            glyph={mark}
          />
        )}
      />
    </View>
  );
};

/** HostPlate needs pixels; the layout gives flex. Measure and forward. */
const MeasuredHost = (props: {
  name: string;
  videoSlot?: ReactNode;
  level?: number;
  speaking?: boolean;
}) => {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  return (
    <View
      style={styles.fill}
      onLayout={e => setSize(e.nativeEvent.layout)}
    >
      {size.width > 0 ? (
        <HostPlate
          width={size.width}
          height={size.height}
          name={props.name}
          videoSlot={props.videoSlot}
          level={props.level}
          speaking={props.speaking}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.void },
  fill: { flex: 1 },
});
