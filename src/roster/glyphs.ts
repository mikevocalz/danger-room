import { PathOp, Skia, type SkPath } from '@shopify/react-native-skia';

/**
 * A mark authored in a 100x100 box. `PlaceholderGlyph` scales it to the cell.
 */
export interface GlyphSpec {
  path: SkPath;
  style?: 'stroke' | 'fill';
  /** Only used when `style` is 'stroke'. */
  strokeWidth?: number;
}

const C = 50;
const RAD = Math.PI / 180;

/** A rotated bar, used to notch gaps out of a ring. */
function bar(angleDeg: number, length: number, halfWidth: number): SkPath {
  const a = angleDeg * RAD;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const px = -dy;
  const py = dx;

  const p = Skia.Path.Make();
  p.moveTo(C + px * halfWidth, C + py * halfWidth);
  p.lineTo(C + dx * length + px * halfWidth, C + dy * length + py * halfWidth);
  p.lineTo(C + dx * length - px * halfWidth, C + dy * length - py * halfWidth);
  p.lineTo(C - px * halfWidth, C - py * halfWidth);
  p.close();
  return p;
}

export interface CircledXOptions {
  /** Outer radius of the ring. */
  ringRadius?: number;
  /** Ring stroke thickness. */
  ringWidth?: number;
  /** Half-width of the notch cut at each cardinal point. 0 for a solid ring. */
  ringGap?: number;
  /** How far each arm reaches from centre. Exceed `ringRadius` to break the ring. */
  armSpan?: number;
  /** Arm half-width where the arms cross. */
  armWidthCenter?: number;
  /** Arm half-width at the tip — larger than centre gives the flared taper. */
  armWidthOuter?: number;
}

/**
 * Ring plus a four-armed tapered X, unioned into a single fill path.
 *
 * Defaults flare the arms outward and break the ring at the cardinals, which is
 * the roster-slot read. Set `ringGap: 0` and equal arm widths for a plain
 * geometric circled X.
 */
export function makeCircledX(options: CircledXOptions = {}): GlyphSpec {
  const {
    ringRadius = 42,
    ringWidth = 7,
    ringGap = 7,
    armSpan = 46,
    armWidthCenter = 6,
    armWidthOuter = 14,
  } = options;

  const outer = Skia.Path.Make();
  outer.addCircle(C, C, ringRadius);

  const inner = Skia.Path.Make();
  inner.addCircle(C, C, Math.max(0, ringRadius - ringWidth));

  let ring = Skia.Path.MakeFromOp(outer, inner, PathOp.Difference) ?? outer;

  if (ringGap > 0) {
    for (const angle of [0, 90, 180, 270]) {
      const notch = bar(angle, ringRadius + 4, ringGap);
      ring = Skia.Path.MakeFromOp(ring, notch, PathOp.Difference) ?? ring;
    }
  }

  // Four arms, wound consistently so the default winding fill unions them.
  // They start behind centre so the crossing has no seam.
  const arms = Skia.Path.Make();
  const back = -armWidthCenter;

  for (const angle of [45, 135, 225, 315]) {
    const a = angle * RAD;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const px = -dy;
    const py = dx;

    arms.moveTo(C + dx * back + px * armWidthCenter, C + dy * back + py * armWidthCenter);
    arms.lineTo(C + dx * armSpan + px * armWidthOuter, C + dy * armSpan + py * armWidthOuter);
    arms.lineTo(C + dx * armSpan - px * armWidthOuter, C + dy * armSpan - py * armWidthOuter);
    arms.lineTo(C + dx * back - px * armWidthCenter, C + dy * back - py * armWidthCenter);
    arms.close();
  }

  const merged = Skia.Path.MakeFromOp(ring, arms, PathOp.Union);

  return { path: merged ?? arms, style: 'fill' };
}

/** Ringed diagonal bar with corner ticks — a neutral "no signal" mark. */
export function makeNoSignal(): GlyphSpec {
  const p = Skia.Path.Make();
  p.addCircle(C, C, 30);
  p.addCircle(C, C, 24);
  p.moveTo(30, 70);
  p.lineTo(70, 30);
  p.moveTo(6, 18);
  p.lineTo(6, 6);
  p.lineTo(18, 6);
  p.moveTo(82, 6);
  p.lineTo(94, 6);
  p.lineTo(94, 18);
  p.moveTo(94, 82);
  p.lineTo(94, 94);
  p.lineTo(82, 94);
  p.moveTo(18, 94);
  p.lineTo(6, 94);
  p.lineTo(6, 82);
  return { path: p, style: 'stroke', strokeWidth: 4 };
}

/** Import your own artwork. */
export function makeFromSVG(d: string, style: 'stroke' | 'fill' = 'fill'): GlyphSpec | null {
  const path = Skia.Path.MakeFromSVGString(d);
  return path ? { path, style } : null;
}
