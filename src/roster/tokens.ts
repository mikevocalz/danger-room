/**
 * Roster console design tokens.
 *
 * Every panel in the room — seat, host plate, name bar — derives its chrome
 * from these values so the whole surface reads as one machined chassis.
 */

export const palette = {
  /** Panel body. */
  chassis: '#2A2E35',
  /** Bevel edge catching light from the top-left. */
  bevelHi: '#7C848F',
  /** Bevel edge falling away to the bottom-right. */
  bevelLo: '#14171B',
  /** Interior of an occupied cell with no signal. */
  void: '#0B0D10',
  /** Interior of an unclaimed seat — warmer, so empty reads as inviting. */
  seatVoid: '#120A1F',
  /** Offline / muted. */
  signal: '#E8452F',
  /** Active speaker. */
  live: '#3DF2A7',
  /** Local (signed-in) participant highlight. */
  self: '#F2C53D',
  /** Name plate ink. */
  ink: '#E6EAF0',
} as const;

/** Neon pair the seat mark is filled with. Swept across the glyph. */
export const seatGlow = ['#FF3D8B', '#7B5CFF'] as const;

/** Seat awaiting a connection. */
export const seatPending = '#FFC24B';

/**
 * The host stage is a different chrome family from the seats: pale console
 * frame, steel-blue inner line, purple CRT screen. Deliberately NOT the dark
 * seat chassis — the stage should never read as an oversized cell.
 */
export const host = {
  /** Outer console frame. */
  frame: '#D6D2C4',
  /** Top-lit edge of that frame. */
  frameHi: '#F1EEE4',
  /** Shadowed edge. */
  frameLo: '#A8A395',
  /** Thin line inboard of the frame. */
  edge: '#8FB4D8',
  /** Header strip behind the name and control squares. */
  header: '#CFCBBD',
  /** Header ink. */
  headerInk: '#3A3730',
  /** Control squares at the header's right. */
  pip: '#9A968A',
  /** Screen gradient: lit centre. */
  screenHi: '#7B34B8',
  /** Screen gradient: falloff. */
  screenLo: '#33199B',
  /** Magenta bloom along the screen's bottom edge. */
  screenBloom: '#C13DE0',
} as const;

export const hostPlate = {
  /** Outer frame thickness on the sides and bottom. */
  frame: 8,
  /** Header strip height. */
  header: 20,
  /** Outer corner radius — squarer than a seat. */
  radius: 3,
  /** Screen corner radius. */
  screenRadius: 2,
  bevel: 2,
  /** Control squares in the header's right end. */
  pipCount: 4,
  pipSize: 6,
  pipGap: 3,
} as const;

/** The host screen rect (video area), in plate-local coordinates. */
export function hostScreen(width: number, height: number) {
  const x = hostPlate.frame;
  const y = hostPlate.header + 2;
  return {
    x,
    y,
    width: Math.max(0, width - hostPlate.frame * 2),
    height: Math.max(0, height - y - hostPlate.frame),
  };
}

/**
 * Plate metals. Silver is the resting material — vacant seats and the host
 * console. Gold is the claim: a seat turns gold the moment someone joins.
 *
 * Both drive the same compiled shader; only the stops differ, so the two
 * states are unmistakably the same object in two finishes.
 */
export const metal = {
  silver: {
    lo: '#8C9096',
    hi: '#E6E8EB',
    /** Bevel edges, lit-to-shadowed. */
    edges: ['#F2F4F6', '#6E7278'] as const,
    /** Stamped-mark shadow / highlight. */
    stampLo: '#6B6F75',
    stampHi: '#F4F6F8',
    ink: '#3A3E44',
  },
  gold: {
    lo: '#B8801E',
    hi: '#F8DE96',
    edges: ['#FFF0BE', '#7A5310'] as const,
    stampLo: '#7A5310',
    stampHi: '#FFF3C8',
    ink: '#2A2008',
  },
} as const;

export type MetalName = keyof typeof metal;

/** Header strip carried by every plate: name at left, status squares at right. */
export const plateHeader = {
  height: 14,
  pipCount: 3,
  // Sized to the header bar so the trio reads like old-Windows min/max/close
  // window controls sitting in the title bar.
  pipSize: 10,
  pipGap: 3,
  inset: 4,
  /** Idle status squares. */
  pipIdle: '#8B8F95',
  /** The live square at the row's end. */
  pipLive: '#3DD46A',
  pipMuted: '#E8452F',
} as const;

export const plate = {
  radius: 6,
  innerRadius: 3,
  /** Chassis thickness on left/right. */
  frame: 7,
  /** Top thickness — carries the header strip. */
  frameTop: 18,
  /** Extra thickness at the bottom to seat the name plate — the well ends here,
   *  leaving a slight gap above the name plate below it. */
  frameBottom: 28,
  bevel: 2,
  rivet: 1.6,
  rivetInset: 4,
} as const;

export const seat = {
  /** How much of the cutout's short edge the mark fills when unclaimed. */
  emptyFit: 0.94,
  /** …and once someone is present but their camera is off. */
  cameraOffFit: 0.44,
  /** Resting opacity of an unclaimed seat's mark. */
  emptyOpacity: 0.55,
} as const;

export const grid = {
  gap: 6, // column gap between seats in a row
  aspect: 4 / 3,
} as const;

/** D4 — vertical gap between the two guest rows. Rows shrink to keep it; the
 *  guest band never grows: seatH = (guestAreaH − SEAT_ROW_GAP) / rows. */
export const SEAT_ROW_GAP = 12;

/**
 * The video cutout, in tile-local coordinates.
 *
 * Both the Skia chassis path and the absolutely-positioned native video view
 * are derived from this, so the feed can never drift out of its hole.
 */
export function cutout(width: number, height: number) {
  return {
    x: plate.frame,
    y: plate.frameTop,
    width: Math.max(0, width - plate.frame * 2),
    height: Math.max(0, height - plate.frameTop - plate.frameBottom),
  };
}

/** The name plate strip, in tile-local coordinates. */
export function namePlateRect(width: number, height: number) {
  const c = cutout(width, height);
  return {
    x: c.x,
    y: c.y + c.height + 2,
    width: c.width,
    height: Math.max(0, plate.frameBottom - 4),
  };
}
