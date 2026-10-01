import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const TAB_H = 22;
const SLANT_W = 18;
const YELLOW = '#eec645';

/**
 * X-Men '97 profile folder overlaid on the live DNA showcase: a folder shape —
 * straight left edge, a name tab whose right edge slants down into the body —
 * with red/yellow/green window buttons at the top-right (same height as the tab,
 * held inside the folder's right edge) and the character description inside.
 */
export const ShowcaseCard = ({
  name,
  description,
  children,
  compact = false,
}: {
  name: string;
  description?: string;
  children: React.ReactNode;
  /** Narrow (40%) panel — shrink the folder so it fits instead of cramming. */
  compact?: boolean;
}) => (
  <View style={styles.root}>
    {children}
    <View style={[styles.card, compact && styles.cardCompact]} pointerEvents="none">
      <View style={styles.tabRow}>
        <View style={styles.tab}>
          <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
            {name.toUpperCase()}
          </Text>
        </View>
        {/* Diagonal from the tab top down to the body top — the folder shape. */}
        <View style={styles.slant} />
        <View style={styles.spacer} />
        {/* Window buttons: same height as the tab, kept inside the right edge.
            flexShrink:0 so a long name can never push them off the folder — the
            name tab truncates (…) instead. */}
        <View style={[styles.dots, compact && styles.dotsCompact]}>
          <View style={[styles.dot, compact && styles.dotCompact, styles.red]}>
            <Text style={styles.dotGlyph}>–</Text>
          </View>
          <View style={[styles.dot, compact && styles.dotCompact, styles.yellow]}>
            <Text style={styles.dotGlyph}>▢</Text>
          </View>
          <View style={[styles.dot, compact && styles.dotCompact, styles.green]}>
            <Text style={styles.dotGlyph}>✕</Text>
          </View>
        </View>
      </View>
      <View style={[styles.body, compact && styles.bodyCompact]}>
        {description ? (
          <Text style={[styles.desc, compact && styles.descCompact]}>{description}</Text>
        ) : null}
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: '46%',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 2, height: 3 },
    elevation: 6,
  },
  cardCompact: { right: 18, bottom: 10, width: '84%' },
  tabRow: { flexDirection: 'row', alignItems: 'flex-end', height: TAB_H },
  tab: {
    height: TAB_H,
    flexShrink: 1, // long names truncate here instead of shoving the buttons out
    backgroundColor: YELLOW,
    borderTopLeftRadius: 6,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  slant: {
    width: 0,
    height: 0,
    flexShrink: 0,
    borderStyle: 'solid',
    borderBottomWidth: TAB_H,
    borderBottomColor: YELLOW,
    borderRightWidth: SLANT_W,
    borderRightColor: 'transparent',
  },
  spacer: { flex: 1 },
  // Same height as the tab (TAB_H), dots vertically centred. Small paddingRight
  // so the green button sits FLUSH at the folder's right edge (not floating with
  // a gap) without spilling past it.
  dots: {
    flexDirection: 'row',
    gap: 5,
    height: TAB_H,
    flexShrink: 0,
    alignItems: 'center',
    paddingRight: 4,
  },
  dotsCompact: { gap: 4, paddingRight: 4 },
  dot: { width: 13, height: 11, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  dotCompact: { width: 11, height: 10 },
  dotGlyph: { color: '#182231', fontSize: 8, fontWeight: '900', lineHeight: 9, includeFontPadding: false },
  red: { backgroundColor: '#e6482e' },
  yellow: { backgroundColor: '#f2c018' },
  green: { backgroundColor: '#3fbf46' },
  name: { color: '#16294d', fontWeight: '800', fontSize: 12, letterSpacing: 1.2 },
  nameCompact: { fontSize: 10, letterSpacing: 0.8 },
  body: {
    backgroundColor: '#e9e4d6',
    borderWidth: 4,
    borderColor: YELLOW,
    borderRadius: 8,
    borderTopLeftRadius: 0,
    minHeight: 120,
    marginTop: -1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  bodyCompact: { borderWidth: 3, minHeight: 0, paddingHorizontal: 11, paddingVertical: 11 },
  desc: { color: '#16294d', fontWeight: '700', fontSize: 16, lineHeight: 24 },
  descCompact: { fontSize: 12, lineHeight: 16 },
});
