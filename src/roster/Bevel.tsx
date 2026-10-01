import React, { useMemo, type ReactNode } from 'react';
import {
  Blur,
  Circle,
  FillType,
  Group,
  LinearGradient,
  Path,
  Skia,
  rect,
  rrect,
  vec,
} from '@shopify/react-native-skia';

import { palette, plate } from './tokens';

export interface BevelProps {
  width: number;
  height: number;
  /** Cutout rect in local coordinates. */
  hole: { x: number; y: number; width: number; height: number };
  /** Chassis fill. Defaults to the console body colour. */
  tone?: string;
  /** Paint node (e.g. <MetalField />) replacing the flat `tone` fill. */
  fill?: ReactNode;
  /** Bevel edge colours, lit-to-shadowed. Defaults to the dark seat chassis. */
  edges?: readonly [string, string];
  /** Corner radii. Defaults to the seat plate tokens. */
  radii?: { outer: number; inner: number };
  /** Inner shadow cast onto the cutout. Set 0 for a flat console screen. */
  innerShadow?: number;
  /** Draw corner rivets. */
  rivets?: boolean;
}

/**
 * The chassis: an even-odd path of `outer rrect minus hole rrect`, so the
 * centre stays genuinely transparent and a native video view shows through.
 *
 * Edges are gradient-stroked — highlight top-left, shadow bottom-right — which
 * is what makes a flat rectangle read as milled metal without any bitmap.
 */
export const Bevel = ({
  width,
  height,
  hole,
  tone = palette.chassis,
  fill,
  edges = [palette.bevelHi, palette.bevelLo],
  radii,
  innerShadow = 0.5,
  rivets = true,
}: BevelProps) => {
  const rOuter = radii?.outer ?? plate.radius;
  const rInner = radii?.inner ?? plate.innerRadius;
  const outer = useMemo(
    () => rrect(rect(0, 0, width, height), rOuter, rOuter),
    [width, height, rOuter],
  );

  const inner = useMemo(
    () =>
      rrect(rect(hole.x, hole.y, hole.width, hole.height), rInner, rInner),
    [hole.x, hole.y, hole.width, hole.height, rInner],
  );

  /** Chassis body with the video hole punched out. */
  const body = useMemo(() => {
    const p = Skia.Path.Make();
    p.addRRect(outer);
    p.addRRect(inner);
    p.setFillType(FillType.EvenOdd);
    return p;
  }, [outer, inner]);

  const outerEdge = useMemo(() => {
    const p = Skia.Path.Make();
    p.addRRect(outer);
    return p;
  }, [outer]);

  const innerEdge = useMemo(() => {
    const p = Skia.Path.Make();
    p.addRRect(inner);
    return p;
  }, [inner]);

  const r = plate.rivet;
  const ri = plate.rivetInset;

  return (
    <Group>
      {/* Body */}
      <Path path={body} color={fill ? undefined : tone}>
        {fill}
      </Path>

      {/* Outer bevel: lit from the top-left. */}
      <Path path={outerEdge} style="stroke" strokeWidth={plate.bevel}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width, height)}
          colors={[edges[0], edges[1]]}
        />
      </Path>

      {/* Inner bevel: reversed, so the cutout reads as recessed. */}
      <Path path={innerEdge} style="stroke" strokeWidth={plate.bevel}>
        <LinearGradient
          start={vec(hole.x, hole.y)}
          end={vec(hole.x + hole.width, hole.y + hole.height)}
          colors={[edges[1], edges[0]]}
        />
      </Path>

      {/* Inner shadow bleeding onto the feed — seats the video in its well. */}
      {innerShadow > 0 ? (
        <Path
          path={innerEdge}
          style="stroke"
          strokeWidth={6}
          color="#000000"
          opacity={innerShadow}
        >
          <Blur blur={4} />
        </Path>
      ) : null}

      {rivets && r > 0 ? (
        <Group color={edges[0]} opacity={0.7}>
          <Circle cx={ri} cy={ri} r={r} />
          <Circle cx={width - ri} cy={ri} r={r} />
          <Circle cx={ri} cy={height - ri} r={r} />
          <Circle cx={width - ri} cy={height - ri} r={r} />
        </Group>
      ) : null}
    </Group>
  );
};
