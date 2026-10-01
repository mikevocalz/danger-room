import React from 'react';
import Animated, { useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated';

import { frameToView, coverScale } from '@/roster/camera/frameToView';
import { COWL } from '@/roster/camera/cowlTemplate';
import type { FilteredFace } from '@/roster/camera/useMaskFilters';

const COWL_IMG = require('../../assets/models/wolverine_cowl.png');

/**
 * The Wolverine cowl (§6.8) — placed by a solved similarity transform against the
 * measured template (cowlTemplate.ts), the Margelo face-pipeline pattern, instead
 * of hand-tuned fudge constants:
 *   scale  s = viewIOD / COWL.iod   (viewIOD = frame-normalized IOD × coverScale —
 *              the cover transform's true distance factor, not plain wellW)
 *   place    the template ANCHOR pixel lands exactly on the tracked anchor point
 *   pivot    rotations happen ABOUT the anchor via the translate–rotate–translate
 *            sandwich (RN rotates about the view centre by default, which made the
 *            mask swing off the face on head tilt)
 *   mirror   front camera mirrors x (frameToView), so roll negates exactly
 * Runs entirely on the UI thread from ONE filtered shared-value channel; hidden
 * when no face (iod → 0).
 *
 * ponytail: two deliberate perf choices, both from the Reanimated perf guidance.
 *  - ONE `face` shared value, not seven. Seven `withTiming` writes per detector
 *    tick was ~182 JS→UI animation starts/sec; this is 26 plain writes/sec.
 *  - The view is laid out at the template's FIXED pixel size and resized with a
 *    `scale` transform. Animating width/height forced a layout pass every frame.
 *    Ceiling: the cowl now updates at the detector's ~26Hz rather than being
 *    tweened to 60Hz. One Euro already smooths it; if it reads steppy, add a
 *    single UI-thread interpolation here rather than reinstating per-channel
 *    timings.
 */
export const MaskOverlay = ({
  face, wellW, wellH, front = true,
}: {
  face: SharedValue<FilteredFace>; wellW: number; wellH: number; front?: boolean;
}) => {
  const style = useAnimatedStyle(() => {
    const f = face.value;
    const visible = wellW > 0 && f.iod > 0.02;
    const viewIod = f.iod * coverScale(f.aspect, wellW, wellH);
    const s = viewIod / COWL.iod;
    const p = frameToView(f.cx, f.cy, f.aspect, wellW, wellH, front);
    const rz = front ? -f.roll : f.roll; // mirrored view ⇒ mirrored roll
    const yy = Math.max(-25, Math.min(25, front ? -f.yaw : f.yaw));
    const xx = Math.max(-15, Math.min(15, -f.pitch));
    // Transforms apply last-to-first (CSS order): anchor offset in template px is
    // scaled by the following `scale`, matching the old `w/2 - anchorX * s`.
    return {
      position: 'absolute',
      left: 0,
      top: 0,
      width: COWL.w,
      height: COWL.h,
      opacity: withTiming(visible ? 1 : 0, { duration: 140 }),
      transform: [
        { perspective: 600 },
        { translateX: p.x - COWL.w / 2 },
        { translateY: p.y - COWL.h / 2 },
        { rotateZ: `${rz}rad` },
        { rotateY: `${yy}deg` },
        { rotateX: `${xx}deg` },
        { scale: s },
        { translateX: COWL.w / 2 - COWL.anchorX },
        { translateY: COWL.h / 2 - COWL.anchorY },
      ],
    };
  }, [wellW, wellH, front]);

  return <Animated.Image source={COWL_IMG} style={style} resizeMode="contain" />;
};
