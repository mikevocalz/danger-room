import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Motion } from '@legendapp/motion';

import { RoomLayout } from '@/roster/layout/RoomLayout';

const PULSE = {
  initial: { opacity: 0.25 },
  animate: { opacity: 0.55 },
  transition: { type: 'timing' as const, duration: 850, loop: -1, repeatReverse: true },
};

/** A single pulsing faceplate (silver chassis look). */
const Plate = ({ style }: { style?: object }) => (
  <View style={[styles.plate, style]}>
    <Motion.View style={styles.plateFill} {...PULSE} />
    <View style={styles.plateHeader} />
  </View>
);

/** Guest grid of skeleton plates, matching RosterGrid's column count. */
const Grid = (columns: number) => (
  <View style={styles.grid}>
    {Array.from({ length: 8 }).map((_, i) => (
      <View key={i} style={[styles.cell, { width: `${100 / columns}%` }]}>
        <Plate />
      </View>
    ))}
  </View>
);

/**
 * Whole-room skeleton: host plate + showcase + folder + 8 guest faceplates, all
 * pulsing, laid out with the SAME RoomLayout so it lines up with the real room.
 * Shown until everything is ready, then crossfaded out in one beat.
 */
export const RoomSkeleton = () => (
  <RoomLayout
    host={<Plate style={styles.fill} />}
    showcase={<Plate style={styles.fill} />}
    guests={(columns) => Grid(columns)}
  />
);

const styles = StyleSheet.create({
  fill: { flex: 1 },
  plate: {
    flex: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1b2c4e',
    borderWidth: 2, borderColor: '#2c447a',
  },
  plateFill: { flex: 1, backgroundColor: '#33507f' },
  plateHeader: { height: 18, backgroundColor: '#22375f' },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  cell: { padding: 4, height: '50%' },
});
